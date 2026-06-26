/** @Acp.Infra.Storage.InMemory.Test — KV roundtrip + event seq monotonicity */
import { describe, it, expect } from 'vitest'
import { Chunk, Effect, Option, Schema } from 'effect'
import { Storage, InMemoryStorageLive } from './index.js'
import type { EventDraft } from './index.js'
import { Event } from '../../protocol/schema/index.js'

const run = <A, E>(program: Effect.Effect<A, E, Storage>): A =>
  Effect.runSync(Effect.provide(program, InMemoryStorageLive))

const draft = (workspace: string, type = 'work.claimed'): EventDraft => {
  const full = Schema.decodeUnknownSync(Event)({
    id: `event_${type}`,
    type,
    workspace_id: workspace,
    actor: 'agent_claude_code',
    timestamp: '2026-06-25T19:02:00Z',
    seq: 0,
    data: {},
  })
  return {
    id: full.id,
    type: full.type,
    workspace_id: full.workspace_id,
    work_id: full.work_id,
    actor: full.actor,
    timestamp: full.timestamp,
    data: full.data,
  }
}

describe('InMemory storage — keyed collections', () => {
  it('puts and gets a value', () => {
    const result = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'work_1', { title: 'fix bug' })
        return yield* s.get('work', 'work_1')
      }),
    )
    expect(Option.getOrNull(result)).toEqual({ title: 'fix bug' })
  })

  it('returns Option.none for a missing key', () => {
    const result = run(
      Effect.gen(function* () {
        const s = yield* Storage
        return yield* s.get('work', 'nope')
      }),
    )
    expect(Option.isNone(result)).toBe(true)
  })

  it('lists all values in a collection and removes one', () => {
    const sizes = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('worker', 'a', 1)
        yield* s.put('worker', 'b', 2)
        const before = yield* s.list('worker')
        yield* s.remove('worker', 'a')
        const after = yield* s.list('worker')
        return [Chunk.size(before), Chunk.size(after)] as const
      }),
    )
    expect(sizes).toEqual([2, 1])
  })
})

describe('InMemory storage — append-only event log', () => {
  it('assigns monotonic per-workspace seq', () => {
    const seqs = run(
      Effect.gen(function* () {
        const s = yield* Storage
        const e1 = yield* s.appendEvent('ws1', draft('ws1'))
        const e2 = yield* s.appendEvent('ws1', draft('ws1'))
        const e3 = yield* s.appendEvent('ws1', draft('ws1'))
        return [e1.seq, e2.seq, e3.seq] as const
      }),
    )
    expect(seqs).toEqual([1, 2, 3])
  })

  it('isolates seq counters across workspaces', () => {
    const seqs = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendEvent('wsA', draft('wsA'))
        const first = yield* s.appendEvent('wsB', draft('wsB'))
        return first.seq
      }),
    )
    expect(seqs).toBe(1)
  })

  it('readEventsAfter returns only events past the given seq', () => {
    const count = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendEvent('ws1', draft('ws1'))
        yield* s.appendEvent('ws1', draft('ws1'))
        yield* s.appendEvent('ws1', draft('ws1'))
        const after = yield* s.readEventsAfter('ws1', 1)
        return Chunk.size(after)
      }),
    )
    expect(count).toBe(2)
  })
})
