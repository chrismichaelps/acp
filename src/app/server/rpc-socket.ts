/** @Acp.App.Server.RpcSocket — GET /rpc WebSocket framing over the in-process router */
import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import type { HttpApp } from '@effect/platform'
import { Effect, Option } from 'effect'
import { executeJsonRpc } from '../../infrastructure/jsonrpc/index.js'
import { dispatchVia, parseErrorEnvelope } from './rpc-endpoint.js'

const decoder = new TextDecoder()

// The bearer token (session id) for a WebSocket connection. A non-browser client
// can set `Authorization: Bearer` on the handshake; a browser cannot, so a
// `?token=` query parameter on the upgrade URL is the fallback. Header wins.
const socketToken = (
  req: HttpServerRequest.HttpServerRequest,
): Option.Option<string> => {
  const header = Option.flatMap(
    Headers.get(req.headers, 'authorization'),
    (value) =>
      value.toLowerCase().startsWith('bearer ')
        ? Option.some(value.slice('bearer '.length).trim())
        : Option.none(),
  )
  if (Option.isSome(header)) {
    return header
  }
  const query = req.url.indexOf('?')
  if (query < 0) {
    return Option.none()
  }
  const token = new URLSearchParams(req.url.slice(query + 1)).get('token')
  return token === null || token === '' ? Option.none() : Option.some(token)
}

const parseJson = (text: string): Option.Option<unknown> => {
  try {
    return Option.some(JSON.parse(text))
  } catch {
    return Option.none()
  }
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
 * `-32700` parse error. The handler effect lives exactly as long as the socket.
 */
export const makeRpcSocketHandler = <E, R>(
  routerApp: HttpApp.Default<E, R>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  Error,
  | Exclude<R, HttpServerRequest.HttpServerRequest>
  | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const token = socketToken(req)
    const socket = yield* req.upgrade
    yield* Effect.scoped(
      Effect.gen(function* () {
        const write = yield* socket.writer
        yield* socket.runRaw((message) =>
          Effect.gen(function* () {
            const text =
              typeof message === 'string' ? message : decoder.decode(message)
            const payload = parseJson(text)
            if (Option.isNone(payload)) {
              yield* write(JSON.stringify(parseErrorEnvelope))
              return
            }
            const out = yield* executeJsonRpc(
              dispatchVia(routerApp),
              payload.value,
              token,
            )
            if (Option.isSome(out)) {
              yield* write(JSON.stringify(out.value))
            }
          }),
        )
      }),
    )
    return HttpServerResponse.empty()
  })
