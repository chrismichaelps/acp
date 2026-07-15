/** @Acp.App.Server.RpcSocket — GET /rpc WebSocket framing over the in-process router */
import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import type { HttpApp } from '@effect/platform'
import { Effect, Either, Option, Schema, Stream } from 'effect'
import { EventStore } from '../../domain/events/index.js'
import type {
  SessionIssuer,
  SessionService,
} from '../../domain/sessions/index.js'
import {
  executeJsonRpc,
  jsonRpcError,
  jsonRpcSuccess,
  JsonRpcRequestError,
  parseJsonRpcCommand,
} from '../../infrastructure/jsonrpc/index.js'
import { Event } from '../../protocol/schema/index.js'
import { toProtocolError } from '../../protocol/errors/protocol-error.js'
import type { DomainError } from '../../protocol/errors/protocol-error.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
} from '../../infrastructure/jsonrpc/index.js'
import type { Scope } from 'effect'
import type { Event as EventModel } from '../../protocol/schema/index.js'
import type { WorkspaceId } from '../../protocol/schema/index.js'
import { dispatchVia, parseErrorEnvelope } from './rpc-endpoint.js'
import { authorizeTokenWorkspace } from './route-support.js'

const decoder = new TextDecoder()

interface JsonRpcEventNotification {
  readonly jsonrpc: '2.0'
  readonly method: 'events.event'
  readonly params: unknown
}

interface SocketToken {
  readonly value: Option.Option<string>
  readonly source: 'header' | 'query' | 'none'
}

const socketToken = (req: HttpServerRequest.HttpServerRequest): SocketToken => {
  const header = Option.flatMap(
    Headers.get(req.headers, 'authorization'),
    (value) =>
      value.toLowerCase().startsWith('bearer ')
        ? Option.some(value.slice('bearer '.length).trim())
        : Option.none(),
  )
  if (Option.isSome(header) && header.value !== '') {
    return { value: header, source: 'header' }
  }
  const query = req.url.indexOf('?')
  if (query < 0) {
    return { value: Option.none(), source: 'none' }
  }
  const token = new URLSearchParams(req.url.slice(query + 1)).get('token')
  return token === null || token === ''
    ? { value: Option.none(), source: 'none' }
    : { value: Option.some(token), source: 'query' }
}

const parseJson = (text: string): Option.Option<unknown> => {
  try {
    return Option.some(JSON.parse(text))
  } catch {
    return Option.none()
  }
}

const streamWorkspaceId = (command: JsonRpcCommand): Option.Option<string> => {
  const url = new URL(`http://acp.internal${command.request.path}`)
  const workspaceId = url.searchParams.get('workspace_id')
  return workspaceId === null || workspaceId === ''
    ? Option.none()
    : Option.some(workspaceId)
}

const eventNotification = (
  event: EventModel,
): Effect.Effect<JsonRpcEventNotification> =>
  Schema.encode(Event)(event).pipe(
    Effect.map((params) => ({
      jsonrpc: '2.0' as const,
      method: 'events.event' as const,
      params,
    })),
    Effect.orDie,
  )

const invalidSubscription = (
  id: Option.Option<JsonRpcId>,
): Option.Option<unknown> =>
  jsonRpcError(
    new JsonRpcRequestError({
      code: -32602,
      message: 'Invalid params',
      id,
      expects_response: Option.isSome(id),
      data: { reason: 'events.subscribe requires workspace_id' },
    }),
  )

const deniedSubscription = (
  command: JsonRpcCommand,
  error: DomainError,
): Option.Option<unknown> => {
  const response = toProtocolError(error)
  return jsonRpcError(
    new JsonRpcRequestError({
      code: -32603,
      message: 'Internal error',
      id: command.id,
      expects_response: command.expects_response,
      data: response.body,
    }),
  )
}

const startEventSubscription = (
  command: JsonRpcCommand,
  token: Option.Option<string>,
  writeJson: (value: unknown) => Effect.Effect<void, Error>,
): Effect.Effect<
  void,
  Error,
  EventStore | SessionIssuer | SessionService | Scope.Scope
> =>
  Effect.gen(function* () {
    const workspaceId = streamWorkspaceId(command)
    if (Option.isNone(workspaceId)) {
      const error = invalidSubscription(command.id)
      if (Option.isSome(error)) {
        yield* writeJson(error.value)
      }
      return
    }

    const authorization = yield* Effect.either(
      authorizeTokenWorkspace(
        Option.getOrElse(token, () => ''),
        'event:read',
        workspaceId.value as WorkspaceId,
      ),
    )
    if (Either.isLeft(authorization)) {
      const error = deniedSubscription(command, authorization.left)
      if (Option.isSome(error)) {
        yield* writeJson(error.value)
      }
      return
    }

    const ack = jsonRpcSuccess(command, {
      subscribed: true,
      workspace_id: workspaceId.value,
    })
    if (Option.isSome(ack)) {
      yield* writeJson(ack.value)
    }

    const store = yield* EventStore
    const events = yield* store.subscribe(workspaceId.value)
    yield* Effect.forkScoped(
      Stream.runForEach(events, (event) =>
        Effect.flatMap(eventNotification(event), writeJson),
      ),
    )
  })

const isSingleEventSubscription = (
  payload: unknown,
): Option.Option<JsonRpcCommand | JsonRpcRequestError> => {
  if (Array.isArray(payload)) {
    return Option.none()
  }
  const parsed = parseJsonRpcCommand(payload)
  if (Either.isLeft(parsed)) {
    return Option.some(parsed.left)
  }
  return parsed.right.request.stream === true &&
    parsed.right.request.label === 'events.subscribe'
    ? Option.some(parsed.right)
    : Option.none()
}

/**
 * The `GET /rpc` WebSocket handler (spec §7: JSON-RPC 2.0 over WebSocket). It
 * upgrades the connection, then for every inbound text frame executes the
 * JSON-RPC payload (single or batch) against the **in-process** {@link routerApp}
 * via the shared-context {@link dispatchVia} — the exact dispatch the `POST /rpc`
 * handler uses, so socket and REST share one `Storage`. The connection's bearer
 * token (handshake `Authorization` header or `?token=` query) authorizes every
 * frame for the life of the socket. A frame's response (when not all
 * notifications) is written back as one text frame; a non-JSON frame echoes a
 * `-32700` parse error. A single `events.subscribe` frame starts a scoped
 * workspace event subscription and emits later events as `events.event`
 * notifications. The handler effect lives exactly as long as the socket.
 */
export const makeRpcSocketHandler = <E, R>(
  routerApp: HttpApp.Default<E, R>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  Error,
  | Exclude<R, HttpServerRequest.HttpServerRequest>
  | EventStore
  | SessionIssuer
  | SessionService
  | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const token = socketToken(req)
    const socket = yield* req.upgrade
    yield* Effect.scoped(
      Effect.gen(function* () {
        const write = yield* socket.writer
        const writes = yield* Effect.makeSemaphore(1)
        const writeJson = (value: unknown) =>
          writes.withPermits(1)(write(JSON.stringify(value)))
        yield* socket.runRaw((message) =>
          Effect.gen(function* () {
            const text =
              typeof message === 'string' ? message : decoder.decode(message)
            const payload = parseJson(text)
            if (Option.isNone(payload)) {
              yield* writeJson(parseErrorEnvelope)
              return
            }
            const subscription = isSingleEventSubscription(payload.value)
            if (Option.isSome(subscription)) {
              if (subscription.value instanceof JsonRpcRequestError) {
                const error = jsonRpcError(subscription.value)
                if (Option.isSome(error)) {
                  yield* writeJson(error.value)
                }
                return
              }
              yield* startEventSubscription(
                subscription.value,
                token.value,
                writeJson,
              )
              return
            }
            const dispatch = dispatchVia(routerApp)
            const out = yield* executeJsonRpc(
              (request) =>
                dispatch(
                  request,
                  token.source === 'query' &&
                    request.path === '/v1/session/initialize'
                    ? Option.none()
                    : token.value,
                ),
              payload.value,
              token.value,
            )
            if (Option.isSome(out)) {
              yield* writeJson(out.value)
            }
          }),
        )
      }),
    )
    return HttpServerResponse.empty()
  })
