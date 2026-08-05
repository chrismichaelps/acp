/** @Acp.Infra.Sandbox.DockerProvider.Test — lifecycle against a fake engine */
import { describe, expect, it } from 'vitest'
import { Effect, Exit, Schema } from 'effect'
import { WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import type { SandboxSpec } from '../../domain/sandbox/index.js'
import { makeDockerSandboxProvider } from './docker-sandbox-provider.js'
import type { DockerEngineApi } from './docker-sandbox-provider.js'

const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_1')

const spec: SandboxSpec = {
  workspaceId,
  workId,
  root: { source: '/srv/w', target: '/srv/w', writable: false },
  writable: [{ source: '/srv/w/a.ts', target: '/srv/w/a.ts', writable: true }],
  networkAllow: [],
  secrets: { ACP_TOKEN: 'sekrit' },
}

interface Recorded {
  readonly calls: string[]
  readonly bodies: unknown[]
}

// `null` means "no such container"; omitting the argument means a running one.
// An explicit `undefined` would trigger the default, which is exactly the trap
// that made the absent-container test pass a running state.
const fakeEngine = (
  state: { Status: string; ExitCode: number } | null = {
    Status: 'running',
    ExitCode: 0,
  },
  failures: Partial<Record<string, Error>> = {},
): { engine: DockerEngineApi; recorded: Recorded } => {
  const recorded: Recorded = { calls: [], bodies: [] }
  const fail = (op: string) =>
    failures[op] === undefined ? Effect.void : Effect.fail(failures[op])
  return {
    recorded,
    engine: {
      createContainer: (name, body) => {
        recorded.calls.push(`create:${name}`)
        recorded.bodies.push(body)
        return Effect.zipRight(fail('create'), Effect.succeed('container_1'))
      },
      startContainer: (id) => {
        recorded.calls.push(`start:${id}`)
        return Effect.zipRight(fail('start'), Effect.void)
      },
      inspectContainer: (name) => {
        recorded.calls.push(`inspect:${name}`)
        return Effect.zipRight(
          fail('inspect'),
          Effect.succeed(
            state === null ? undefined : { Id: 'container_1', State: state },
          ),
        )
      },
      removeContainer: (name) => {
        recorded.calls.push(`remove:${name}`)
        return Effect.zipRight(fail('remove'), Effect.void)
      },
    },
  }
}

const run = <A, E>(program: Effect.Effect<A, E>) => Effect.runSyncExit(program)

describe('docker sandbox provider', () => {
  it('removes, creates, starts, then reports the running sandbox', () => {
    const { engine, recorded } = fakeEngine()
    const provider = makeDockerSandboxProvider(engine, { image: 'acp/agent:1' })
    const exit = run(provider.start(spec))

    expect(Exit.isSuccess(exit)).toBe(true)
    expect(recorded.calls).toEqual([
      'remove:acp-sandbox-work_1',
      'create:acp-sandbox-work_1',
      'start:container_1',
      'inspect:acp-sandbox-work_1',
    ])
    if (Exit.isSuccess(exit)) {
      expect(exit.value.status).toBe('running')
      expect(exit.value.externalId).toBe('container_1')
    }
  })

  it('is idempotent: starting twice does not duplicate the sandbox', () => {
    const { engine, recorded } = fakeEngine()
    const provider = makeDockerSandboxProvider(engine, { image: 'acp/agent:1' })
    run(provider.start(spec))
    run(provider.start(spec))
    // The same deterministic name is removed before each create, so two starts
    // converge on one sandbox rather than accumulating containers.
    expect(recorded.calls.filter((c) => c.startsWith('create:'))).toHaveLength(
      2,
    )
    expect(
      new Set(recorded.calls.filter((c) => c.startsWith('create:'))).size,
    ).toBe(1)
  })

  it('tolerates a missing container when removing before create', () => {
    const { engine } = fakeEngine(null, {
      remove: new Error('no such container'),
    })
    const provider = makeDockerSandboxProvider(engine, { image: 'acp/agent:1' })
    // A first-ever start has nothing to remove; that must not fail the start.
    expect(Exit.isFailure(run(provider.start(spec)))).toBe(false)
  })

  it('reports absent for a work unit with no container', () => {
    const { engine } = fakeEngine(null)
    const provider = makeDockerSandboxProvider(engine, { image: 'acp/agent:1' })
    const exit = run(provider.inspect(workId))
    if (Exit.isSuccess(exit)) expect(exit.value.status).toBe('absent')
  })

  it('surfaces an exit code once the container has exited', () => {
    const { engine } = fakeEngine({ Status: 'exited', ExitCode: 137 })
    const provider = makeDockerSandboxProvider(engine, { image: 'acp/agent:1' })
    const exit = run(provider.inspect(workId))
    if (Exit.isSuccess(exit)) {
      expect(exit.value.status).toBe('exited')
      expect(exit.value.exitCode).toBe(137)
    }
  })

  it('maps a create failure to a StorageError rather than a defect', () => {
    const { engine } = fakeEngine(null, {
      create: new Error('daemon unreachable'),
    })
    const provider = makeDockerSandboxProvider(engine, { image: 'acp/agent:1' })
    const exit = run(provider.start(spec))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('passes the built spec through to the engine unchanged', () => {
    const { engine, recorded } = fakeEngine()
    const provider = makeDockerSandboxProvider(engine, { image: 'acp/agent:1' })
    run(provider.start(spec))
    const body = recorded.bodies[0] as {
      Image: string
      HostConfig: { NetworkMode: string; Mounts: { ReadOnly: boolean }[] }
    }
    expect(body.Image).toBe('acp/agent:1')
    expect(body.HostConfig.NetworkMode).toBe('none')
    expect(body.HostConfig.Mounts[0]?.ReadOnly).toBe(true)
    expect(body.HostConfig.Mounts[1]?.ReadOnly).toBe(false)
  })
})
