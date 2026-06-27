/** @Acp.Domain.Sessions.Service — Session registry + actor resolution */
import { Chunk, Context, Duration, Effect, Layer, Option, Schema } from 'effect'
import { Storage } from '../../infrastructure/storage/index.js'
import { StorageError } from '../../protocol/errors/protocol-error.js'
import { Session } from '../../protocol/schema/index.js'
import type {
  SessionId,
  Timestamp,
  WorkerId,
} from '../../protocol/schema/index.js'

export interface SessionServiceApi {
  readonly create: (session: Session) => Effect.Effect<Session, StorageError>
  readonly get: (
    sessionId: SessionId,
  ) => Effect.Effect<Option.Option<Session>, StorageError>
  readonly resolveActor: (
    token: string,
  ) => Effect.Effect<Option.Option<WorkerId>, StorageError>
  readonly list: () => Effect.Effect<readonly Session[], StorageError>
  readonly evictExpired: (
    now: Timestamp,
    ttl: Duration.Duration,
  ) => Effect.Effect<readonly Session[], StorageError>
}

export class SessionService extends Context.Tag('SessionService')<
  SessionService,
  SessionServiceApi
>() {}

const collection = 'session'

const decodeStoredSession = (value: unknown) =>
  Schema.decodeUnknown(Session)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_session',
          cause: String(error),
        }),
    ),
  )

const make = Effect.gen(function* () {
  const storage = yield* Storage

  const encodeSession = (session: Session) =>
    Schema.encode(Session)(session).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_session',
            cause: String(error),
          }),
      ),
    )

  const create: SessionServiceApi['create'] = (session) =>
    Effect.as(
      Effect.flatMap(encodeSession(session), (encoded) =>
        storage.put(collection, session.id, encoded),
      ),
      session,
    )

  const get: SessionServiceApi['get'] = (sessionId) =>
    Effect.flatMap(storage.get(collection, sessionId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<Session>()),
        onSome: (value) => Effect.map(decodeStoredSession(value), Option.some),
      }),
    )

  const resolveActor: SessionServiceApi['resolveActor'] = (token) =>
    Effect.map(
      get(token as SessionId),
      Option.map((session) => session.worker_id),
    )

  const list: SessionServiceApi['list'] = () =>
    Effect.flatMap(storage.list(collection), (stored) =>
      Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredSession),
    )

  const evictExpired: SessionServiceApi['evictExpired'] = (now, ttl) =>
    Effect.gen(function* () {
      const ttlMillis = Duration.toMillis(ttl)
      const expired = (yield* list()).filter(
        (session) =>
          Date.parse(session.created_at) + ttlMillis <= Date.parse(now),
      )
      yield* Effect.forEach(expired, (session) =>
        storage.remove(collection, session.id),
      )
      return expired
    })

  return {
    create,
    get,
    resolveActor,
    list,
    evictExpired,
  } satisfies SessionServiceApi
})

export const SessionServiceLive: Layer.Layer<SessionService, never, Storage> =
  Layer.effect(SessionService, make)
