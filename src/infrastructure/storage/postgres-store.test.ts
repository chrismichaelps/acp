/** @Acp.Infra.Storage.Postgres.Test — adapter contract against a live Postgres */
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Chunk, Effect, Option, Redacted, Schema } from 'effect'
import { Event, Memory, ReadMemoryQuery } from '../../protocol/schema/index.js'
import { makePostgresStorageLive, Storage } from './index.js'
import type { EventDraft, MemoryDraft } from './index.js'

// Integration test: runs only when ACP_TEST_DATABASE_URL points at a reachable
// Postgres. It is skipped in CI and any environment without a database, so the
// unit suite stays hermetic. The fallback URL is never dialed — the whole
// describe is skipped when the variable is unset.
const url = process.env.ACP_TEST_DATABASE_URL
const dbUrl = url ?? 'postgresql://unused'

const layer = makePostgresStorageLive(dbUrl)

const run = <A, E>(program: Effect.Effect<A, E, Storage>): Promise<A> =>
  Effect.runPromise(Effect.provide(program, layer))

const truncate = Effect.provide(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`TRUNCATE kv, events, event_seq, memory, memory_seq`
  }),
  PgClient.layer({ url: Redacted.make(dbUrl) }),
)

const draft = (
  workspace: string,
  timestamp = '2026-07-03T10:00:00Z',
): EventDraft => {
  const full = Schema.decodeUnknownSync(Event)({
    id: `event_pg_${timestamp}`,
    type: 'work.claimed',
    workspace_id: workspace,
    actor: 'agent_claude_code',
    timestamp,
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
    created_at: '2026-07-03T10:00:00Z',
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

const query = (input: unknown) =>
  Schema.decodeUnknownSync(ReadMemoryQuery)(input)

describe.skipIf(url === undefined)('Postgres storage adapter', () => {
  // Build the layer once to run migrations, so the per-test TRUNCATE has tables.
  beforeAll(async () => {
    await run(
      Effect.gen(function* () {
        yield* Storage
      }),
    )
  })

  beforeEach(async () => {
    await Effect.runPromise(truncate)
  })

  it('puts and gets a JSON value, lists in key order, removes', async () => {
    const result = await run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'work_1', { title: 'fix bug' })
        yield* s.put('work', 'work_2', { title: 'other' })
        const got = yield* s.get('work', 'work_1')
        const before = yield* s.list('work')
        yield* s.remove('work', 'work_1')
        const after = yield* s.list('work')
        return {
          got: Option.getOrNull(got),
          before: Chunk.size(before),
          after: Chunk.size(after),
        }
      }),
    )
    expect(result.got).toEqual({ title: 'fix bug' })
    expect(result).toMatchObject({ before: 2, after: 1 })
  })

  it('returns Option.none for a missing key', async () => {
    const missing = await run(
      Effect.gen(function* () {
        const s = yield* Storage
        return yield* s.get('work', 'nope')
      }),
    )
    expect(Option.isNone(missing)).toBe(true)
  })

  it('assigns monotonic per-workspace event seq, isolated across workspaces', async () => {
    const seqs = await run(
      Effect.gen(function* () {
        const s = yield* Storage
        const e1 = yield* s.appendEvent('wsA', draft('wsA'))
        const e2 = yield* s.appendEvent('wsA', draft('wsA'))
        const e3 = yield* s.appendEvent('wsA', draft('wsA'))
        const other = yield* s.appendEvent('wsB', draft('wsB'))
        return [e1.seq, e2.seq, e3.seq, other.seq] as const
      }),
    )
    expect(seqs).toEqual([1, 2, 3, 1])
  })

  it('readEventsAfter returns only events past the cursor', async () => {
    const count = await run(
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

  it('prunes aged events, keeps the newest as seq watermark', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendEvent('ws1', draft('ws1', '2000-01-01T00:00:00Z'))
        yield* s.appendEvent('ws1', draft('ws1', '2000-06-01T00:00:00Z'))
        yield* s.appendEvent('ws1', draft('ws1', '2100-01-01T00:00:00Z'))
        const pruned = yield* s.pruneEventsBefore('2050-01-01T00:00:00Z')
        const remaining = yield* s.readEventsAfter('ws1', 0)
        const next = yield* s.appendEvent(
          'ws1',
          draft('ws1', '2100-02-01T00:00:00Z'),
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

  it('assigns memory seq and reads by cursor + key filter', async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const s = yield* Storage
        const m1 = yield* s.appendMemory(
          'ws1',
          memoryDraft('ws1', 'memory_1', 'a'),
        )
        const m2 = yield* s.appendMemory(
          'ws1',
          memoryDraft('ws1', 'memory_2', 'b'),
        )
        yield* s.appendMemory('ws1', memoryDraft('ws1', 'memory_3', 'b'))
        const byKey = yield* s.readMemory(
          query({ workspace_id: 'ws1', after_seq: 0, key: 'b' }),
        )
        return {
          seqs: [m1.seq, m2.seq] as const,
          keys: Chunk.toReadonlyArray(byKey).map((r) => r.key),
        }
      }),
    )
    expect(outcome.seqs).toEqual([1, 2])
    expect(outcome.keys).toEqual(['b', 'b'])
  })
})
