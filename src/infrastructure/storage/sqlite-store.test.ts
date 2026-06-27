/** @Acp.Infra.Storage.Sqlite.Test — SQLite adapter contract */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { Chunk, Effect, Option, Schema } from 'effect'
import { Event } from '../../protocol/schema/index.js'
import {
  makeSqliteStorageLive,
  SqliteMemoryStorageLive,
  Storage,
} from './index.js'
import type { EventDraft } from './index.js'

const run = <A, E>(program: Effect.Effect<A, E, Storage>): A =>
  Effect.runSync(Effect.provide(program, SqliteMemoryStorageLive))

const draft = (workspace: string, type = 'work.claimed'): EventDraft => {
  const full = Schema.decodeUnknownSync(Event)({
    id: `event_sqlite_${type}`,
    type,
    workspace_id: workspace,
    actor: 'agent_claude_code',
    timestamp: '2026-06-27T15:00:00Z',
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

const queryPlan = (
  dbPath: string,
  sql: string,
  ...params: readonly (number | string)[]
): string => {
  const db = new DatabaseSync(dbPath)
  try {
    return db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...params)
      .map((row) => (typeof row.detail === 'string' ? row.detail : ''))
      .join('\n')
  } finally {
    db.close()
  }
}

describe('SQLite storage — keyed collections', () => {
  it('puts and gets a JSON value', () => {
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

  it('lists values in key order and removes one', () => {
    const values = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('worker', 'b', 2)
        yield* s.put('worker', 'a', 1)
        const before = yield* s.list('worker')
        yield* s.remove('worker', 'a')
        const after = yield* s.list('worker')
        return {
          before: Chunk.toReadonlyArray(before),
          after: Chunk.toReadonlyArray(after),
        }
      }),
    )
    expect(values).toEqual({ before: [1, 2], after: [2] })
  })
})

describe('SQLite storage — append-only event log', () => {
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
    const seq = run(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.appendEvent('wsA', draft('wsA'))
        const first = yield* s.appendEvent('wsB', draft('wsB'))
        return first.seq
      }),
    )
    expect(seq).toBe(1)
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

  it('reads a small tail from a large workspace event log', () => {
    const seqs = run(
      Effect.gen(function* () {
        const s = yield* Storage
        for (let i = 0; i < 2_000; i += 1) {
          yield* s.appendEvent('ws_large', draft('ws_large'))
        }
        for (let i = 0; i < 1_000; i += 1) {
          yield* s.appendEvent('ws_other', draft('ws_other'))
        }
        const tail = yield* s.readEventsAfter('ws_large', 1_995)
        return Chunk.toReadonlyArray(tail).map((event) => event.seq)
      }),
    )
    expect(seqs).toEqual([1996, 1997, 1998, 1999, 2000])
  })
})

describe('SQLite storage — file persistence', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('persists keyed values and event seq across reopened layers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acp-sqlite-'))
    dirs.push(dir)
    const dbPath = join(dir, 'acp.sqlite')
    const layer = makeSqliteStorageLive(dbPath)

    Effect.runSync(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('work', 'work_1', { title: 'persisted' })
        yield* s.appendEvent('ws1', draft('ws1'))
      }).pipe(Effect.provide(layer)),
    )

    const reopened = Effect.runSync(
      Effect.gen(function* () {
        const s = yield* Storage
        const stored = yield* s.get('work', 'work_1')
        const second = yield* s.appendEvent('ws1', draft('ws1'))
        return { stored, seq: second.seq }
      }).pipe(Effect.provide(layer)),
    )

    expect(Option.getOrNull(reopened.stored)).toEqual({ title: 'persisted' })
    expect(reopened.seq).toBe(2)
  })

  it('uses composite primary-key indexes for hot collection and event reads', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acp-sqlite-plan-'))
    dirs.push(dir)
    const dbPath = join(dir, 'acp.sqlite')
    const layer = makeSqliteStorageLive(dbPath)

    Effect.runSync(
      Effect.gen(function* () {
        const s = yield* Storage
        yield* s.put('worker', 'worker_1', { name: 'A' })
        yield* s.appendEvent('workspace_1', draft('workspace_1'))
      }).pipe(Effect.provide(layer)),
    )

    const collectionPlan = queryPlan(
      dbPath,
      'SELECT value FROM kv WHERE collection = ? ORDER BY id ASC',
      'worker',
    )
    const eventPlan = queryPlan(
      dbPath,
      `SELECT value FROM events
       WHERE workspace_id = ? AND seq > ?
       ORDER BY seq ASC`,
      'workspace_1',
      0,
    )

    expect(collectionPlan).toContain('USING PRIMARY KEY')
    expect(eventPlan).toContain('USING PRIMARY KEY')
  })
})
