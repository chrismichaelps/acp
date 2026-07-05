/** @Acp.App.Cli.Client.Test — HTTP request construction */
import { HttpClient, HttpClientResponse } from '@effect/platform'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { applyClientFilter, runCliRequest } from './client.js'

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

describe('applyClientFilter', () => {
  const base = { method: 'GET', path: '/v1/x', label: 'work list' } as const
  const body = JSON.stringify([
    { id: 'work_1', state: 'open' },
    { id: 'work_2', state: 'running' },
    { id: 'work_3', state: 'open' },
  ])

  it('returns the body unchanged when no filterState is set', () => {
    expect(applyClientFilter(base, body)).toBe(body)
  })

  it('keeps only array elements whose state matches', () => {
    const out = applyClientFilter({ ...base, filterState: 'open' }, body)
    expect(JSON.parse(out)).toEqual([
      { id: 'work_1', state: 'open' },
      { id: 'work_3', state: 'open' },
    ])
  })

  it('yields an empty array when nothing matches', () => {
    const out = applyClientFilter({ ...base, filterState: 'blocked' }, body)
    expect(JSON.parse(out)).toEqual([])
  })

  it('passes through a non-array body (e.g. a host error object)', () => {
    const err = JSON.stringify({ error: { code: 'not_found' } })
    expect(applyClientFilter({ ...base, filterState: 'open' }, err)).toBe(err)
  })

  it('passes through unparseable bodies without throwing', () => {
    expect(
      applyClientFilter({ ...base, filterState: 'open' }, 'not json'),
    ).toBe('not json')
  })
})
