/** @Acp.App.Cli.Client — send a CliRequest to the local ACP host */
import { HttpClient, HttpClientRequest } from '@effect/platform'
import { Effect } from 'effect'
import type { CliRequest } from './commands.js'

export interface CliResult {
  readonly status: number
  readonly body: string
}

export const runCliRequest = (request: CliRequest, baseUrl: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const url = `${baseUrl}${request.path}`
    const base =
      request.method === 'GET'
        ? HttpClientRequest.get(url)
        : request.method === 'PATCH'
          ? HttpClientRequest.patch(url)
          : HttpClientRequest.post(url)
    const httpRequest =
      request.body === undefined
        ? base
        : yield* HttpClientRequest.bodyJson(base, request.body)
    const response = yield* client.execute(httpRequest)
    const body = yield* response.text
    return { status: response.status, body } satisfies CliResult
  })
