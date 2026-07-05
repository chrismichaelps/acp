/** @Acp.Infra.Storage.InMemory.Test — KV roundtrip + event seq monotonicity */
import { describe, it, expect } from 'vitest'
import { Chunk, Effect, Option, Schema } from 'effect'
import { Storage, InMemoryStorageLive } from './index.js'
import type { EventDraft, MemoryDraft } from './index.js'
import {
  Event,
  Memory,
  ReadMemoryQuery,
  Timestamp,
} from '../../protocol/schema/index.js'

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

const memoryDraft = (
  workspace: string,
  id: string,
  key = 'handoff.note',
): MemoryDraft => {
  const full = Schema.decodeUnknownSync(Memory)({
    id,
    workspace_id: workspace,
    work_id: 'work_1',
    seq: 0,
    created_by: 'agent_claude_code',
    kind: 'note',
    key,
    summary: `Memory ${id}`,
    content: `Content ${id}`,
    labels: ['handoff'],
    created_at: '2026-06-25T19:11:00Z',
  })
  return {
    id: full.id,
    workspace_id: full.workspace_id,
    work_id: full.work_id,
    created_by: full.created_by,
    kind: full.kind,
    key: full.key,
    summary: full.summary,
    content: full.content,
    labels: full.labels,
    created_at: full.created_at,
  }
}

const memoryQuery = (input: unknown) =>
  Schema.decodeUnknownSync(ReadMemoryQuery)(input)

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

  it('puts only when absent and replaces only when unchanged', () => {
    const result = run(
      Effect.gen(function* () {
        const s = yield* Storage
        const first = yield* s.putIfAbsent('locks', 'resource', {
          holder: 'a',
        })
        const second = yield* s.putIfAbsent('locks', 'resource', {
          holder: 'b',
        })
        const stale = yield* s.replaceIf(
          'locks',
          'resource',
          { holder: 'b' },
          { holder: 'c' },
        )
        const fresh = yield* s.replaceIf(
          'locks',
          'resource',
          { holder: 'a' },
          { holder: 'c' },
        )
        const got = yield* s.get('locks', 'resource')
        return { first, second, stale, fresh, got: Option.getOrNull(got) }
      }),
    )

    expect(result).toEqual({
      first: true,
      second: false,
      stale: false,
      fresh: true,
      got: { holder: 'c' },
    })
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

describe('InMemory storage — workspace memory', () => {
  it('assigns monotonic per-workspace memory seq', () => {
    const seqs = run(
      Effect.gen(function* () {
        const s = yield* Storage
        const m1 = yield* s.appendMemory('ws1', memoryDraft('ws1', 'memory_1'))
        const m2 = yield* s.appendMemory('ws1', memoryDraft('ws1', 'memory_2'))
        const other = yield* s.appendMemory(
          'ws2',
          memoryDraft('ws2', 'memory_3'),
        )
        return [m1.seq, m2.seq, other.seq] as const
      }),
    )
    expect(seqs).toEqual([1, 2, 1])
  })

  it('reads memory by cursor and key filter', () => {
    const keys = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendMemory('ws1', memoryDraft('ws1', 'memory_1', 'a'))
        yield* s.appendMemory('ws1', memoryDraft('ws1', 'memory_2', 'b'))
        yield* s.appendMemory('ws1', memoryDraft('ws1', 'memory_3', 'b'))
        const records = yield* s.readMemory(
          memoryQuery({ workspace_id: 'ws1', after_seq: 1, key: 'b' }),
        )
        return Chunk.toReadonlyArray(records).map((record) => record.key)
      }),
    )
    expect(keys).toEqual(['b', 'b'])
  })
})

const draftAt = (workspace: string, timestamp: string): EventDraft => ({
  ...draft(workspace),
  timestamp: Schema.decodeUnknownSync(Timestamp)(timestamp),
})

describe('InMemory storage — event retention pruning', () => {
  it('prunes events older than the cutoff, keeps the newest as seq watermark', () => {
    const outcome = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendEvent('ws1', draftAt('ws1', '2000-01-01T00:00:00Z'))
        yield* s.appendEvent('ws1', draftAt('ws1', '2000-06-01T00:00:00Z'))
        yield* s.appendEvent('ws1', draftAt('ws1', '2100-01-01T00:00:00Z'))
        const pruned = yield* s.pruneEventsBefore('2050-01-01T00:00:00Z')
        const remaining = yield* s.readEventsAfter('ws1', 0)
        // Next append must continue the high-water-mark, not reuse a seq.
        const next = yield* s.appendEvent(
          'ws1',
          draftAt('ws1', '2100-02-01T00:00:00Z'),
        )
        return {
          pruned,
          remainingSeqs: Chunk.toReadonlyArray(remaining).map((e) => e.seq),
          nextSeq: next.seq,
        }
      }),
    )
    expect(outcome.pruned).toBe(2)
    expect(outcome.remainingSeqs).toEqual([3])
    expect(outcome.nextSeq).toBe(4)
  })

  it('keeps exactly the newest event when every event is aged out', () => {
    const remaining = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendEvent('ws1', draftAt('ws1', '2000-01-01T00:00:00Z'))
        yield* s.appendEvent('ws1', draftAt('ws1', '2000-02-01T00:00:00Z'))
        const pruned = yield* s.pruneEventsBefore('2050-01-01T00:00:00Z')
        const tail = yield* s.readEventsAfter('ws1', 0)
        return { pruned, seqs: Chunk.toReadonlyArray(tail).map((e) => e.seq) }
      }),
    )
    expect(remaining.pruned).toBe(1)
    expect(remaining.seqs).toEqual([2])
  })

  it('isolates pruning per workspace', () => {
    const kept = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendEvent('wsA', draftAt('wsA', '2000-01-01T00:00:00Z'))
        yield* s.appendEvent('wsA', draftAt('wsA', '2100-01-01T00:00:00Z'))
        yield* s.appendEvent('wsB', draftAt('wsB', '2100-01-01T00:00:00Z'))
        yield* s.pruneEventsBefore('2050-01-01T00:00:00Z')
        const b = yield* s.readEventsAfter('wsB', 0)
        return Chunk.size(b)
      }),
    )
    expect(kept).toBe(1)
  })
})
