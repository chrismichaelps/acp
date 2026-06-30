/** @Acp.App.Server.MemoryRoutes — workspace memory handlers */
import { HttpServerRequest } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { MemoryService } from '../../domain/memory/index.js'
import { MemoryListParams } from '../../infrastructure/http/index.js'
import type { MemoryId } from '../../protocol/schema/index.js'
import { CreateMemoryPayload, Memory } from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'
import { authorize, ok, respond } from './route-support.js'

export const createMemory = respond(
  Effect.gen(function* () {
    const memory = yield* MemoryService
    const idClock = yield* IdClock
    const payload = yield* HttpServerRequest.schemaBodyJson(CreateMemoryPayload)
    const id = (yield* idClock.nextId('memory')) as MemoryId
    const now = yield* idClock.now
    const actor = yield* authorize('memory:create')
    const created = yield* memory.create({
      id,
      payload,
      createdBy: actor,
      now,
    })
    return yield* ok(201)(Memory, created)
  }),
)

export const listMemory = respond(
  Effect.gen(function* () {
    const memory = yield* MemoryService
    // MemoryListParams decodes URL strings straight into the ReadMemoryQuery
    // shape (Option-wrapped fields, NumberFromString for after_seq/limit), so it
    // feeds memory.read directly — re-decoding the Option values would fail.
    const query = yield* HttpServerRequest.schemaSearchParams(MemoryListParams)
    yield* authorize('memory:read')
    const records = yield* memory.read(query)
    return yield* ok(200)(Schema.Array(Memory), records)
  }),
)
