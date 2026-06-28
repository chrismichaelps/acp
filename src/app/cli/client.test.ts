/** @Acp.App.Cli.Client.Test — HTTP request construction */
import { HttpClient, HttpClientResponse } from '@effect/platform'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { runCliRequest } from './client.js'

describe('runCliRequest', () => {
  it('uses DELETE for delete requests', async () => {
    const seen: string[] = []
    const client = HttpClient.make((request) => {
      seen.push(request.method)
      seen.push(request.url)
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response('deleted')),
      )
    })

    const result = await Effect.runPromise(
      runCliRequest(
        {
          method: 'DELETE',
          path: '/v1/artifacts/artifact_123',
          label: 'artifact delete',
        },
        'http://localhost:4317',
      ).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, client))),
    )

    expect(result).toEqual({ status: 200, body: 'deleted' })
    expect(seen).toEqual([
      'DELETE',
      'http://localhost:4317/v1/artifacts/artifact_123',
    ])
  })
})
