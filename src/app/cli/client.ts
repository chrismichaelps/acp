/** @Acp.App.Cli.Client — send a CliRequest to the local ACP host */
import { HttpClient, HttpClientRequest } from '@effect/platform'
import { Effect } from 'effect'
import type { CliRequest } from './commands.js'

export interface CliResult {
  readonly status: number
  readonly body: string
}

export const withBearerToken = (
  request: HttpClientRequest.HttpClientRequest,
  token: string,
) =>
  token === ''
    ? request
    : HttpClientRequest.setHeader(request, 'authorization', `Bearer ${token}`)

/**
 * Pure post-fetch narrowing for list commands. When `request.filterState` is
 * set and `body` parses to a JSON array, keep only elements whose `state`
 * equals the requested value and re-serialize. A non-array body or any parse
 * failure returns `body` unchanged, so the CLI never masks a host error.
 */
export const applyClientFilter = (
  request: CliRequest,
  body: string,
): string => {
  const state = request.filterState
  if (state === undefined) return body
  try {
    const parsed: unknown = JSON.parse(body)
    if (!Array.isArray(parsed)) return body
    const filtered = parsed.filter(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        (item as { state?: unknown }).state === state,
    )
    return JSON.stringify(filtered)
  } catch {
    return body
  }
}

export const runCliRequest = (
  request: CliRequest,
  baseUrl: string,
  token = '',
) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const url = `${baseUrl}${request.path}`
    const base =
      request.method === 'GET'
        ? HttpClientRequest.get(url)
        : request.method === 'PATCH'
          ? HttpClientRequest.patch(url)
          : request.method === 'DELETE'
            ? HttpClientRequest.del(url)
            : HttpClientRequest.post(url)
    const httpRequest =
      request.body === undefined
        ? withBearerToken(base, token)
        : withBearerToken(
            yield* HttpClientRequest.bodyJson(base, request.body),
            token,
          )
    const response = yield* client.execute(httpRequest)
    const body = yield* response.text
    return { status: response.status, body } satisfies CliResult
  })
