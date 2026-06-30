/** @Acp.Infra.Rpc.TelemetryMiddleware — native RPC structured completion logs */
import { RpcMiddleware } from '@effect/rpc'
import { Cause, Clock, Effect, Exit, Layer, Option } from 'effect'

const protocolErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('error' in error)) {
    return undefined
  }
  const body = (error as { readonly error?: unknown }).error
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return undefined
  }
  const code = (body as { readonly code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

const errorAnnotations = <E>(
  exit: Exit.Exit<unknown, E>,
): Record<string, string> => {
  if (Exit.isSuccess(exit)) {
    return {}
  }
  const failure = Cause.failureOption(exit.cause)
  if (Option.isNone(failure)) {
    return { rpc_failure: 'defect' }
  }
  const code = protocolErrorCode(failure.value)
  if (code === undefined) {
    return { rpc_failure: 'error' }
  }
  return { error_code: code, rpc_failure: 'error' }
}

export class AcpRpcTelemetryMiddleware extends RpcMiddleware.Tag<AcpRpcTelemetryMiddleware>()(
  '@acp/rpc/TelemetryMiddleware',
  { wrap: true },
) {}

export const AcpRpcTelemetryMiddlewareLive = Layer.succeed(
  AcpRpcTelemetryMiddleware,
  (options) =>
    Effect.gen(function* () {
      const startedAt = yield* Clock.currentTimeMillis
      return yield* options.next.pipe(
        Effect.withLogSpan(`acp.rpc.${options.rpc._tag}`),
        Effect.onExit((exit) =>
          Effect.gen(function* () {
            const finishedAt = yield* Clock.currentTimeMillis
            const annotations = {
              rpc_client_id: options.clientId,
              rpc_operation: options.rpc._tag,
              rpc_outcome: Exit.isSuccess(exit) ? 'success' : 'failure',
              duration_ms: finishedAt - startedAt,
              ...errorAnnotations(exit),
            }
            const log = Exit.isSuccess(exit)
              ? Effect.logInfo('rpc request completed')
              : Effect.logWarning('rpc request completed')
            yield* log.pipe(Effect.annotateLogs(annotations))
          }),
        ),
      )
    }),
)
