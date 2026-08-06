/** @Acp.Domain.Workers.Expiry.Test — lapsed registrations go offline, not away */
import { describe, expect, it } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { Timestamp, Worker, WorkerId } from '../../protocol/schema/index.js'
import { WorkerService, WorkerServiceLive } from './index.js'

const TestLive = Layer.provideMerge(WorkerServiceLive, InMemoryStorageLive)

const run = <A, E>(program: Effect.Effect<A, E, WorkerService>): A =>
  Effect.runSync(Effect.provide(program, TestLive))

const id = (raw: string) => Schema.decodeUnknownSync(WorkerId)(raw)

const worker = (raw: string, expiresAt?: string) =>
  Schema.decodeUnknownSync(Worker)({
    id: raw,
    name: raw,
    kind: 'agent',
    status: 'online',
    capabilities: [],
    ...(expiresAt === undefined ? {} : { expires_at: expiresAt }),
  })

const ts = (raw: string) => Schema.decodeUnknownSync(Timestamp)(raw)
const now = ts('2026-08-06T12:00:00Z')
const past = ts('2026-08-06T11:00:00Z')
const future = ts('2026-08-06T13:00:00Z')

describe('worker registration expiry', () => {
  it('marks a worker whose registration lapsed as offline', () => {
    const result = run(
      Effect.gen(function* () {
        const svc = yield* WorkerService
        yield* svc.register(worker('agent_lapsed', past))
        const expired = yield* svc.expireLapsed(now)
        const stored = yield* svc.get(id('agent_lapsed'))
        return { expired, status: Option.getOrThrow(stored).status }
      }),
    )
    expect(result.expired.map((w) => w.id)).toEqual(['agent_lapsed'])
    expect(result.status).toBe('offline')
  })

  it('preserves the row and its expiry so attribution still resolves', () => {
    // Events attribute work by worker id; deleting the row would leave dangling
    // references and destroy the audit trail this exists to protect.
    const stored = run(
      Effect.gen(function* () {
        const svc = yield* WorkerService
        yield* svc.register(worker('agent_lapsed', past))
        yield* svc.expireLapsed(now)
        return yield* svc.get(id('agent_lapsed'))
      }),
    )
    expect(Option.isSome(stored)).toBe(true)
    expect(Option.getOrThrow(stored).expires_at).toEqual(Option.some(past))
  })

  it('leaves a worker whose registration is still live alone', () => {
    const expired = run(
      Effect.gen(function* () {
        const svc = yield* WorkerService
        yield* svc.register(worker('agent_live', future))
        return yield* svc.expireLapsed(now)
      }),
    )
    expect(expired).toEqual([])
  })

  it('ignores a worker with no expiry at all', () => {
    const expired = run(
      Effect.gen(function* () {
        const svc = yield* WorkerService
        yield* svc.register(worker('agent_forever'))
        return yield* svc.expireLapsed(now)
      }),
    )
    expect(expired).toEqual([])
  })

  it('does not re-expire a worker that is already offline', () => {
    const expired = run(
      Effect.gen(function* () {
        const svc = yield* WorkerService
        yield* svc.register(worker('agent_lapsed', past))
        yield* svc.expireLapsed(now)
        return yield* svc.expireLapsed(now)
      }),
    )
    expect(expired).toEqual([])
  })
})
