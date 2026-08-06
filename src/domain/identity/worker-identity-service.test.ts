/** @Acp.Domain.Identity.Service.Test — enforcement modes and attribution */
import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { Cause, Effect, Exit, Layer, Option, Schema } from 'effect'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import { EventStoreLive, InProcessEventBrokerLive } from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { WorkerService, WorkerServiceLive } from '../workers/index.js'
import { Worker, WorkerId } from '../../protocol/schema/index.js'
import {
  canonicalAssertionPayload,
  publicKeyToBase64,
} from './worker-assertion.js'
import type { WorkerAssertion } from './worker-assertion.js'
import {
  WorkerIdentityService,
  WorkerIdentityServiceLive,
} from './worker-identity-service.js'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const encodedKey = publicKeyToBase64(publicKey)
const other = generateKeyPairSync('ed25519')

const signedId = Schema.decodeUnknownSync(WorkerId)('agent_signed')
const unsignedId = Schema.decodeUnknownSync(WorkerId)('agent_unsigned')
const now = '2026-08-05T10:00:00Z'

const workerRow = (id: string, key?: string) =>
  Schema.decodeUnknownSync(Worker)({
    id,
    name: id,
    kind: 'agent',
    status: 'online',
    capabilities: [],
    ...(key === undefined ? {} : { public_key: key }),
  })

const assertion = (
  over: Partial<WorkerAssertion> = {},
  key = privateKey,
): WorkerAssertion => {
  const claims = {
    workerId: signedId as string,
    action: 'work.claim' as const,
    targetId: 'work_1',
    timestamp: now,
    ...over,
  }
  return {
    ...claims,
    signature: sign(
      null,
      Buffer.from(canonicalAssertionPayload(claims), 'utf8'),
      key,
    ).toString('base64'),
  }
}

const layerWith = (requireWorkerSignatures: boolean) => {
  const base = Layer.merge(
    Layer.provideMerge(
      EventStoreLive,
      Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
    ),
    TestAppConfigLive({ requireWorkerSignatures }),
  )
  const workers = Layer.provideMerge(WorkerServiceLive, base)
  return Layer.provideMerge(
    WorkerIdentityServiceLive,
    Layer.merge(workers, TestAppConfigLive({ requireWorkerSignatures })),
  )
}

type Env = WorkerIdentityService | WorkerService

const runExit = <A, E>(
  program: Effect.Effect<A, E, Env>,
  enforce: boolean,
): Exit.Exit<A, E> =>
  Effect.runSyncExit(Effect.provide(program, layerWith(enforce)))

const failureTag = <A, E>(exit: Exit.Exit<A, E>): string => {
  if (Exit.isSuccess(exit)) return 'Success'
  return Option.match(Cause.failureOption(exit.cause), {
    onNone: () => 'Defect',
    onSome: (error) => (error as { _tag?: string })._tag ?? String(error),
  })
}

const register = Effect.flatMap(WorkerService, (svc) =>
  Effect.zipRight(
    svc.register(workerRow('agent_signed', encodedKey)),
    svc.register(workerRow('agent_unsigned')),
  ),
)

const verify = (
  workerId: WorkerId,
  given: WorkerAssertion | undefined,
  target = 'work_1',
) =>
  Effect.flatMap(WorkerIdentityService, (svc) =>
    svc.verify({
      workerId,
      action: 'work.claim',
      targetId: target,
      assertion: given === undefined ? Option.none() : Option.some(given),
      now,
    }),
  )

describe('worker identity — enforcement off', () => {
  it('permits an unsigned claim and records it as unsigned', () => {
    const exit = runExit(
      Effect.zipRight(register, verify(unsignedId, undefined)),
      false,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) expect(exit.value.signed).toBe(false)
  })

  it('records a valid signature as signed', () => {
    const exit = runExit(
      Effect.zipRight(register, verify(signedId, assertion())),
      false,
    )
    if (Exit.isSuccess(exit)) expect(exit.value.signed).toBe(true)
  })

  // Enforcement controls whether proof is *required*, not whether a *failed*
  // proof is acceptable. Accepting a signature that does not verify would make
  // the recorded `signed` flag meaningless, so this is rejected in both modes.
  it('rejects a present-but-invalid signature even when unenforced', () => {
    const exit = runExit(
      Effect.zipRight(
        register,
        verify(signedId, assertion({}, other.privateKey)),
      ),
      false,
    )
    expect(failureTag(exit)).toBe('ForbiddenError')
  })

  it('rejects an assertion replayed against a different target', () => {
    const exit = runExit(
      Effect.zipRight(register, verify(signedId, assertion(), 'work_2')),
      false,
    )
    expect(failureTag(exit)).toBe('ForbiddenError')
  })
})

describe('worker identity — enforcement on', () => {
  it('accepts a valid signature', () => {
    const exit = runExit(
      Effect.zipRight(register, verify(signedId, assertion())),
      true,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) expect(exit.value.signed).toBe(true)
  })

  it('refuses an unsigned claim', () => {
    const exit = runExit(
      Effect.zipRight(register, verify(signedId, undefined)),
      true,
    )
    expect(failureTag(exit)).toBe('ForbiddenError')
  })

  it('refuses a worker that registered without a public key', () => {
    const exit = runExit(
      Effect.zipRight(register, verify(unsignedId, assertion())),
      true,
    )
    expect(failureTag(exit)).toBe('ForbiddenError')
  })

  it('refuses an assertion whose worker id is not the acting worker', () => {
    const exit = runExit(
      Effect.zipRight(
        register,
        verify(signedId, assertion({ workerId: 'agent_someone_else' })),
      ),
      true,
    )
    expect(failureTag(exit)).toBe('ForbiddenError')
  })

  it('reports a missing worker as not found rather than forbidden', () => {
    const exit = runExit(
      verify(Schema.decodeUnknownSync(WorkerId)('agent_absent'), undefined),
      true,
    )
    expect(failureTag(exit)).toBe('NotFoundError')
  })
})
