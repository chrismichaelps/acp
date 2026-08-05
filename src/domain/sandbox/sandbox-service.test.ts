/** @Acp.Domain.Sandbox.Service.Test — leases, mounts and provider composed */
import { describe, expect, it } from 'vitest'
import { Cause, Effect, Exit, Layer, Option, Schema } from 'effect'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import { NoHooksLive } from '../hooks/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { LeaseService, LeaseServiceLive } from '../leases/index.js'
import { WorkUnitService, WorkUnitServiceLive } from '../work-units/index.js'
import {
  CreateWorkPayload,
  RequestLeasePayload,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { LeaseId } from '../../protocol/schema/index.js'
import { SandboxProvider } from './sandbox-provider.js'
import type { SandboxSpec } from './sandbox-provider.js'
import { SandboxService, SandboxServiceLive } from './sandbox-service.js'

const workerId = Schema.decodeUnknownSync(WorkerId)('agent_a')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_sbx')
const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const now = Schema.decodeUnknownSync(Timestamp)('2026-08-05T10:00:00Z')

/** Captures the spec handed to the provider, so composition is observable. */
const recordingProvider = () => {
  const seen: SandboxSpec[] = []
  const layer = Layer.succeed(SandboxProvider, {
    start: (spec) =>
      Effect.sync(() => {
        seen.push(spec)
        return { workId: spec.workId, status: 'running' as const }
      }),
    inspect: (id) => Effect.succeed({ workId: id, status: 'running' as const }),
    stop: () => Effect.void,
  })
  return { seen, layer }
}

const layerWith = (providerLayer: Layer.Layer<SandboxProvider>) => {
  const config = TestAppConfigLive({
    workspaceRoot: Option.some('/srv/w'),
    sandboxImage: Option.some('acp/agent:1'),
  })
  const base = Layer.merge(
    Layer.provideMerge(
      EventStoreLive,
      Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
    ),
    Layer.mergeAll(config, NoHooksLive),
  )
  const work = Layer.provideMerge(WorkUnitServiceLive, base)
  const leases = Layer.provideMerge(LeaseServiceLive, base)
  return Layer.provideMerge(
    SandboxServiceLive,
    Layer.mergeAll(work, leases, providerLayer, config),
  )
}

type Env = SandboxService | WorkUnitService | LeaseService

const runExit = <A, E>(
  program: Effect.Effect<A, E, Env>,
  providerLayer: Layer.Layer<SandboxProvider>,
): Exit.Exit<A, E> =>
  Effect.runSyncExit(Effect.provide(program, layerWith(providerLayer)))

const failureTag = <A, E>(exit: Exit.Exit<A, E>): string => {
  if (Exit.isSuccess(exit)) return 'Success'
  return Option.match(Cause.failureOption(exit.cause), {
    onNone: () => 'Defect',
    onSome: (error) => (error as { _tag?: string })._tag ?? String(error),
  })
}

const createWork = Effect.flatMap(WorkUnitService, (svc) =>
  svc.create({
    id: workId,
    payload: Schema.decodeUnknownSync(CreateWorkPayload)({
      workspace_id: workspaceId,
      title: 'Task',
    }),
    createdBy: workerId,
    now,
  }),
)

let leaseSeq = 0
const takeLease = (uri: string, forWork = workId) =>
  Effect.flatMap(LeaseService, (svc) =>
    svc.request({
      id: `lease_${String((leaseSeq += 1))}` as LeaseId,
      payload: Schema.decodeUnknownSync(RequestLeasePayload)({
        workspace_id: workspaceId,
        work_id: forWork,
        holder: workerId,
        resource: { kind: 'file', uri },
      }),
      now,
    }),
  )

const ensure = Effect.flatMap(SandboxService, (svc) => svc.ensure(workId, now))

describe('sandbox service', () => {
  it('mounts the workspace read-only and leased paths read-write', () => {
    const { seen, layer } = recordingProvider()
    const exit = runExit(
      Effect.gen(function* () {
        yield* createWork
        yield* takeLease('file:///srv/w/src/app.ts')
        return yield* ensure
      }),
      layer,
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.root).toEqual({
      source: '/srv/w',
      target: '/srv/w',
      writable: false,
    })
    expect(seen[0]?.writable.map((m) => m.target)).toEqual([
      '/srv/w/src/app.ts',
    ])
  })

  it('grants nothing writable when the work unit holds no leases', () => {
    const { seen, layer } = recordingProvider()
    runExit(Effect.zipRight(createWork, ensure), layer)
    expect(seen[0]?.writable).toEqual([])
  })

  it('excludes a lease held for a different work unit', () => {
    const { seen, layer } = recordingProvider()
    const other = Schema.decodeUnknownSync(WorkId)('work_other')
    runExit(
      Effect.gen(function* () {
        yield* createWork
        yield* takeLease('file:///srv/w/theirs.ts', other)
        return yield* ensure
      }),
      layer,
    )
    expect(seen[0]?.writable).toEqual([])
  })

  it('passes the work and workspace identity to the provider', () => {
    const { seen, layer } = recordingProvider()
    runExit(Effect.zipRight(createWork, ensure), layer)
    expect(seen[0]?.workId).toBe(workId)
    expect(seen[0]?.workspaceId).toBe(workspaceId)
  })

  it('denies egress by default', () => {
    const { seen, layer } = recordingProvider()
    runExit(Effect.zipRight(createWork, ensure), layer)
    expect(seen[0]?.networkAllow).toEqual([])
  })

  it('fails for an unknown work unit rather than provisioning', () => {
    const { seen, layer } = recordingProvider()
    const exit = runExit(ensure, layer)
    expect(failureTag(exit)).toBe('NotFoundError')
    expect(seen).toEqual([])
  })

  it('reports status without provisioning', () => {
    const { seen, layer } = recordingProvider()
    const exit = runExit(
      Effect.flatMap(SandboxService, (svc) => svc.status(workId)),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(seen).toEqual([])
  })
})
