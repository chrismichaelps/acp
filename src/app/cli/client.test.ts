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

  it('forwards ACP bearer tokens on JSON requests', async () => {
    const seen: string[] = []
    const client = HttpClient.make((request) => {
      seen.push(request.method)
      seen.push(request.headers.authorization)
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response('created')),
      )
    })

    const result = await Effect.runPromise(
      runCliRequest(
        {
          method: 'POST',
          path: '/v1/work',
          body: { workspace_id: 'workspace_1', title: 'Auth scoped work' },
          label: 'work create',
        },
        'http://localhost:4317',
        'session_123',
      ).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, client))),
    )

    expect(result).toEqual({ status: 200, body: 'created' })
    expect(seen).toEqual(['POST', 'Bearer session_123'])
  })

  it('leaves Authorization unset when no token is configured', async () => {
    const seen: (string | undefined)[] = []
    const client = HttpClient.make((request) => {
      seen.push(request.headers.authorization)
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response('listed')),
      )
    })

    const result = await Effect.runPromise(
      runCliRequest(
        {
          method: 'GET',
          path: '/v1/workspaces',
          label: 'workspace list',
        },
        'http://localhost:4317',
      ).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, client))),
    )

    expect(result).toEqual({ status: 200, body: 'listed' })
    expect(seen).toEqual([undefined])
  })
})
