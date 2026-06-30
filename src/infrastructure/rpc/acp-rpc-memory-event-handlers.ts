/** @Acp.Infra.Rpc.MemoryEventHandlers — native RPC memory and event handlers */
import { Chunk, Effect, Layer, Stream } from 'effect'
import { EventStore } from '../../domain/events/index.js'
import { MemoryService } from '../../domain/memory/index.js'
import { IdClock } from '../../app/server/identity.js'
import type { MemoryId } from '../../protocol/schema/index.js'
import { AcpRpcGroup } from './acp-rpc-contract.js'
import { rpcActor } from './rpc-auth.js'
import { toRpcError } from './rpc-error.js'

const memoryCreateHandler = AcpRpcGroup.toLayerHandler(
  'memory.create',
  (payload, options) =>
    Effect.gen(function* () {
      const actor = yield* rpcActor(options.headers, 'memory:create')
      const memory = yield* MemoryService
      const idClock = yield* IdClock
      const id = (yield* idClock.nextId('memory')) as MemoryId
      const now = yield* idClock.now
      return yield* memory
        .create({ id, payload, createdBy: actor, now })
        .pipe(Effect.mapError(toRpcError))
    }),
)

const memoryListHandler = AcpRpcGroup.toLayerHandler(
  'memory.list',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcActor(options.headers, 'memory:read')
      const memory = yield* MemoryService
      return yield* memory.read(payload).pipe(Effect.mapError(toRpcError))
    }),
)

const eventListHandler = AcpRpcGroup.toLayerHandler(
  'events.list',
  (payload, options) =>
    Effect.gen(function* () {
      yield* rpcActor(options.headers, 'event:read')
      const events = yield* EventStore
      const replay = yield* events
        .readAfter(payload.workspace_id, payload.after_seq)
        .pipe(Effect.mapError(toRpcError))
      return Chunk.toReadonlyArray(replay)
    }),
)

const eventSubscribeHandler = AcpRpcGroup.toLayerHandler(
  'events.subscribe',
  (payload, options) =>
    Stream.unwrapScoped(
      Effect.gen(function* () {
        yield* rpcActor(options.headers, 'event:read')
        const events = yield* EventStore
        return yield* events.subscribe(payload.workspace_id)
      }),
    ),
)

export const AcpRpcMemoryEventHandlersLive = Layer.mergeAll(
  memoryCreateHandler,
  memoryListHandler,
  eventListHandler,
  eventSubscribeHandler,
)
