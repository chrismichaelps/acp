/** @Acp.App.Cli.GhBridgeSupport — ACP HTTP helpers for the gh bridge */
import type { HttpClient } from '@effect/platform'
import { Data, Effect } from 'effect'
import { runCliRequest } from './client.js'

export class BridgeError extends Data.TaggedError('BridgeError')<{
  readonly message: string
}> {}

const toBridgeError = (error: unknown): BridgeError =>
  new BridgeError({ message: `acp request failed: ${String(error)}` })

const parseBody = (body: string): unknown =>
  body === '' ? null : JSON.parse(body)

const send = (
  baseUrl: string,
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Effect.Effect<unknown, BridgeError, HttpClient.HttpClient> =>
  runCliRequest(
    {
      method,
      path,
      label: `gh bridge ${method} ${path}`,
      ...(body === undefined ? {} : { body }),
    },
    baseUrl,
    token,
  ).pipe(
    Effect.mapError(toBridgeError),
    Effect.flatMap((result) =>
      result.status >= 400
        ? Effect.fail(
            new BridgeError({
              message: `acp ${method} ${path} failed (${String(result.status)}): ${result.body}`,
            }),
          )
        : Effect.try({
            try: () => parseBody(result.body),
            catch: (error) => toBridgeError(error),
          }),
    ),
  )

export const acpPost = (
  baseUrl: string,
  token: string,
  path: string,
  body: unknown,
): Effect.Effect<unknown, BridgeError, HttpClient.HttpClient> =>
  send(baseUrl, token, 'POST', path, body as Record<string, unknown>)

export const acpGet = (
  baseUrl: string,
  token: string,
  path: string,
): Effect.Effect<unknown, BridgeError, HttpClient.HttpClient> =>
  send(baseUrl, token, 'GET', path)
