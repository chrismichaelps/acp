/** @Acp.Infra.JsonRpc.Runtime — execute normalized commands into JSON-RPC responses */
import { Effect, Either, Option } from 'effect'
import {
  JsonRpcRequestError,
  jsonRpcError,
  jsonRpcSuccess,
  parseJsonRpcCommand,
} from './json-rpc.js'
import type {
  JsonRpcCommand,
  JsonRpcHttpRequest,
  JsonRpcResponse,
} from './json-rpc.js'

export interface JsonRpcDispatchResult {
  readonly status: number
  readonly body: unknown
}

/**
 * Executes one canonical command against the running host. Each transport injects
 * its own: in tests and over HTTP it wraps the {@link acpRouter} web handler; a
 * stdio adapter would fetch the local server. `token` threads the connection's
 * bearer session onto the request so spec §8 scopes are enforced by the router.
 */
export type JsonRpcDispatch = (
  request: JsonRpcHttpRequest,
  token: Option.Option<string>,
) => Effect.Effect<JsonRpcDispatchResult>

const isSuccessStatus = (status: number) => status >= 200 && status < 300

// Collapse a non-2xx dispatch into the closed JSON-RPC reserved-code set, keeping
// the structured ACP error body as `data`. Suppressed for notifications.
const errorResponse = (
  command: JsonRpcCommand,
  result: JsonRpcDispatchResult,
): Option.Option<JsonRpcResponse> =>
  jsonRpcError(
    new JsonRpcRequestError({
      code: result.status === 400 ? -32602 : -32603,
      message: result.status === 400 ? 'Invalid params' : 'Internal error',
      id: command.id,
      expects_response: command.expects_response,
      data: result.body,
    }),
  )

const foldResult = (
  command: JsonRpcCommand,
  result: JsonRpcDispatchResult,
): Option.Option<JsonRpcResponse> =>
  isSuccessStatus(result.status)
    ? jsonRpcSuccess(command, result.body)
    : errorResponse(command, result)

// Long-lived SSE cannot ride a request/response reply — clients use the SSE route.
const streamRejected = (
  command: JsonRpcCommand,
): Option.Option<JsonRpcResponse> =>
  jsonRpcError(
    new JsonRpcRequestError({
      code: -32603,
      message: 'Internal error',
      id: command.id,
      expects_response: command.expects_response,
      data: { reason: 'streaming requires the SSE transport' },
    }),
  )

const executeSingle = (
  dispatch: JsonRpcDispatch,
  value: unknown,
  token: Option.Option<string>,
): Effect.Effect<Option.Option<JsonRpcResponse>> =>
  Either.match(parseJsonRpcCommand(value), {
    onLeft: (error) => Effect.succeed(jsonRpcError(error)),
    onRight: (command) =>
      command.request.stream === true
        ? Effect.succeed(streamRejected(command))
        : Effect.map(dispatch(command.request, token), (result) =>
            foldResult(command, result),
          ),
  })

const emptyBatchError: JsonRpcResponse = {
  jsonrpc: '2.0',
  id: null,
  error: { code: -32600, message: 'Invalid Request' },
}

/**
 * Executes a single envelope or a batch array, returning the response(s) to send
 * or `None` when nothing should be replied (a lone notification, or an
 * all-notification batch). An empty batch array is a single `-32600` error.
 */
export const executeJsonRpc = (
  dispatch: JsonRpcDispatch,
  payload: unknown,
  token: Option.Option<string>,
): Effect.Effect<
  Option.Option<JsonRpcResponse | readonly JsonRpcResponse[]>
> => {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return Effect.succeed(Option.some(emptyBatchError))
    }
    return Effect.map(
      Effect.forEach(payload, (value) => executeSingle(dispatch, value, token)),
      (responses) => {
        const sendable = responses.flatMap((response) =>
          Option.match(response, {
            onNone: () => [],
            onSome: (value) => [value],
          }),
        )
        return sendable.length === 0 ? Option.none() : Option.some(sendable)
      },
    )
  }
  return executeSingle(dispatch, payload, token)
}
