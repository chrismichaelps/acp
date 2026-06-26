/** @Acp.Domain.Workers.Service.Test — Worker registry */
import { describe, expect, it } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { Worker, WorkerId } from '../../protocol/schema/index.js'
import { WorkerService, WorkerServiceLive } from './index.js'

const TestLive = Layer.provideMerge(WorkerServiceLive, InMemoryStorageLive)

const runSync = <A, E>(program: Effect.Effect<A, E, WorkerService>): A =>
  Effect.runSync(Effect.provide(program, TestLive))

const workerId = Schema.decodeUnknownSync(WorkerId)('agent_claude_code')

const decodeWorker = (status = 'online') =>
  Schema.decodeUnknownSync(Worker)({
    id: 'agent_claude_code',
    name: 'Claude Code',
    kind: 'agent',
    vendor: 'anthropic',
    status,
    capabilities: ['can_edit_files', 'can_review'],
  })

describe('WorkerService', () => {
  it('registers a worker and reads it back', () => {
    const result = runSync(
      Effect.gen(function* () {
        const workers = yield* WorkerService
        const registered = yield* workers.register(decodeWorker())
        const stored = yield* workers.get(workerId)
        return { registered, stored }
      }),
    )

    expect(result.registered.id).toBe(workerId)
    expect(Option.getOrNull(result.stored)).toEqual(result.registered)
  })

  it('upserts on re-register, overwriting the prior record', () => {
    const stored = runSync(
      Effect.gen(function* () {
        const workers = yield* WorkerService
        yield* workers.register(decodeWorker('online'))
        yield* workers.register(decodeWorker('busy'))
        return yield* workers.get(workerId)
      }),
    )

    expect(Option.getOrNull(stored)?.status).toBe('busy')
  })

  it('returns Option.none for an unknown worker', () => {
    const stored = runSync(
      Effect.gen(function* () {
        const workers = yield* WorkerService
        return yield* workers.get(
          Schema.decodeUnknownSync(WorkerId)('worker_missing'),
        )
      }),
    )

    expect(Option.isNone(stored)).toBe(true)
  })

  it('lists all registered workers', () => {
    const ids = runSync(
      Effect.gen(function* () {
        const workers = yield* WorkerService
        yield* workers.register(decodeWorker())
        yield* workers.register(
          Schema.decodeUnknownSync(Worker)({
            id: 'human_dana',
            name: 'Dana',
            kind: 'human',
            status: 'idle',
            capabilities: [],
          }),
        )
        const all = yield* workers.list()
        return all.map((worker) => worker.id).sort()
      }),
    )

    expect(ids).toEqual(['agent_claude_code', 'human_dana'])
  })

  it('updates a worker status', () => {
    const updated = runSync(
      Effect.gen(function* () {
        const workers = yield* WorkerService
        yield* workers.register(decodeWorker('online'))
        return yield* workers.setStatus(workerId, 'offline')
      }),
    )

    expect(updated.status).toBe('offline')
  })

  it('fails setStatus with NotFoundError for a missing worker', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const workers = yield* WorkerService
          return yield* workers.setStatus(
            Schema.decodeUnknownSync(WorkerId)('worker_missing'),
            'busy',
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('NotFoundError')
    }
  })
})
