/** @Acp.App.Server.RpcEndpoint — POST /rpc framing over the in-process router */
import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import type { HttpApp } from '@effect/platform'
import { Effect, Either, Option, Schema } from 'effect'
import { executeJsonRpc } from '../../infrastructure/jsonrpc/index.js'
import type { JsonRpcDispatch } from '../../infrastructure/jsonrpc/index.js'

// Read the bearer token (session id) from the incoming /rpc Authorization header.
const bearerToken = Effect.map(
  HttpServerRequest.HttpServerRequest,
  (req): Option.Option<string> =>
    Option.flatMap(Headers.get(req.headers, 'authorization'), (header) =>
      header.toLowerCase().startsWith('bearer ')
        ? Option.some(header.slice('bearer '.length).trim())
        : Option.none(),
    ),
)

// Dispatch a canonical command by replaying it against the SAME router app in the
// shared service context — no second AppLive, so /rpc and /v1 hit one store.
const dispatchVia =
  <E, R>(
    routerApp: HttpApp.Default<E, R>,
  ): JsonRpcDispatch<Exclude<R, HttpServerRequest.HttpServerRequest>> =>
  (request, token) =>
    Effect.gen(function* () {
      const webRequest = new Request(`http://acp.internal${request.path}`, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          ...(Option.isSome(token)
            ? { authorization: `Bearer ${token.value}` }
            : {}),
        },
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
      })
      const response = yield* Effect.provideService(
        routerApp,
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(webRequest),
      )
      const web = HttpServerResponse.toWeb(response)
      const body = yield* Effect.promise(
        (): Promise<unknown> =>
          web.status === 204 ? Promise.resolve(null) : web.json(),
      )
      return { status: web.status, body }
    }).pipe(
      // Commands only ever carry valid v1 paths, so RouteNotFound is unreachable;
      // mapping it keeps the dispatch total (E = never) for the runtime.
      Effect.catchAll(() =>
        Effect.succeed({
          status: 404,
          body: { error: { code: 'not_found', message: 'No matching route' } },
        }),
      ),
    )

const parseError: HttpServerResponse.HttpServerResponse =
  HttpServerResponse.unsafeJson(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    },
    { status: 200 },
  )

/**
 * The `POST /rpc` handler: read the JSON-RPC payload (single or batch) and the
 * connection's bearer token, execute each method against {@link routerApp} via the
 * shared-context {@link dispatchVia}, and return the response JSON — or `204` when
 * there is nothing to reply (all notifications). A non-JSON body is a JSON-RPC
 * `-32700` parse error (HTTP `200`), per spec §13.
 */
export const makeRpcHandler = <E, R>(
  routerApp: HttpApp.Default<E, R>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  | Exclude<R, HttpServerRequest.HttpServerRequest>
  | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const token = yield* bearerToken
    const payload = yield* Effect.either(
      HttpServerRequest.schemaBodyJson(Schema.Unknown),
    )
    if (Either.isLeft(payload)) {
      return parseError
    }
    const out = yield* executeJsonRpc(
      dispatchVia(routerApp),
      payload.right,
      token,
    )
    return Option.match(out, {
      onNone: () => HttpServerResponse.empty({ status: 204 }),
      onSome: (response) =>
        HttpServerResponse.unsafeJson(response, { status: 200 }),
    })
  })
