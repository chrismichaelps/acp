/** @Acp.Infra.Events.PgNotifyBroker.Test — live Postgres fan-out adapter */
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Effect, Fiber, Layer, Option, Redacted, Schema, Stream } from 'effect'
import { EventBroker } from '../../domain/events/index.js'
import { Event } from '../../protocol/schema/index.js'
import {
  makePostgresStorageLive,
  Storage,
  type EventDraft,
} from '../storage/index.js'
import { makePgNotifyEventBrokerLive } from './index.js'

const url = process.env.ACP_TEST_DATABASE_URL
const dbUrl = url ?? 'postgresql://unused'
const storageLayer = makePostgresStorageLive(dbUrl)
const brokerLayer = Layer.provide(
  makePgNotifyEventBrokerLive(dbUrl),
  storageLayer,
)
const layer = Layer.merge(storageLayer, brokerLayer)

const run = <A, E>(
  program: Effect.Effect<A, E, Storage | EventBroker>,
): Promise<A> => Effect.runPromise(Effect.provide(program, layer))

const truncate = Effect.provide(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`TRUNCATE kv, events, event_seq, memory, memory_seq`
  }),
  PgClient.layer({ url: Redacted.make(dbUrl) }),
)

const draft = (workspace: string): EventDraft => {
  const full = Schema.decodeUnknownSync(Event)({
    id: `event_pg_notify_${workspace}`,
    type: 'work.progressed',
    workspace_id: workspace,
    actor: 'agent_codex',
    timestamp: '2026-07-03T12:00:00Z',
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

describe.skipIf(url === undefined)('Postgres NOTIFY EventBroker', () => {
  beforeAll(async () => {
    await run(Effect.flatMap(Storage, () => Effect.void))
  })

  beforeEach(async () => {
    await Effect.runPromise(truncate)
  })

  it('delivers a persisted event pointer through LISTEN/NOTIFY', async () => {
    const result = await run(
      Effect.scoped(
        Effect.gen(function* () {
          const storage = yield* Storage
          const broker = yield* EventBroker
          const stream = yield* broker.subscribe()
          const fiber = yield* Effect.fork(Stream.runHead(stream))

          const persisted = yield* storage.appendEvent(
            'workspace_pg_notify',
            draft('workspace_pg_notify'),
          )
          yield* broker.publish(persisted)

          const observed = yield* Fiber.join(fiber)
          return { persisted, observed }
        }),
      ),
    )

    expect(Option.getOrNull(result.observed)).toEqual(result.persisted)
  })
})
