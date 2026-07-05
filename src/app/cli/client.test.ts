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
    { id: 'work_1', priority: 'high', state: 'open' },
    {
      assigned_to: 'worker_1',
      id: 'work_2',
      priority: 'high',
      state: 'running',
    },
    {
      assigned_to: 'worker_2',
      id: 'work_3',
      priority: 'normal',
      state: 'open',
    },
  ])

  it('returns the body unchanged when no clientFilters are set', () => {
    expect(applyClientFilter(base, body)).toBe(body)
  })

  it('keeps only array elements whose state matches', () => {
    const out = applyClientFilter(
      { ...base, clientFilters: [{ field: 'state', value: 'open' }] },
      body,
    )
    expect(JSON.parse(out)).toEqual([
      { id: 'work_1', priority: 'high', state: 'open' },
      {
        assigned_to: 'worker_2',
        id: 'work_3',
        priority: 'normal',
        state: 'open',
      },
    ])
  })

  it('keeps only array elements whose priority matches', () => {
    const out = applyClientFilter(
      { ...base, clientFilters: [{ field: 'priority', value: 'high' }] },
      body,
    )
    expect(JSON.parse(out)).toEqual([
      { id: 'work_1', priority: 'high', state: 'open' },
      {
        assigned_to: 'worker_1',
        id: 'work_2',
        priority: 'high',
        state: 'running',
      },
    ])
  })

  it('requires all client filters to match', () => {
    const out = applyClientFilter(
      {
        ...base,
        clientFilters: [
          { field: 'state', value: 'open' },
          { field: 'priority', value: 'high' },
        ],
      },
      body,
    )
    expect(JSON.parse(out)).toEqual([
      { id: 'work_1', priority: 'high', state: 'open' },
    ])
  })

  it('keeps only array elements whose assignee matches', () => {
    const out = applyClientFilter(
      { ...base, clientFilters: [{ field: 'assigned_to', value: 'worker_1' }] },
      body,
    )
    expect(JSON.parse(out)).toEqual([
      {
        assigned_to: 'worker_1',
        id: 'work_2',
        priority: 'high',
        state: 'running',
      },
    ])
  })

  it('yields an empty array when nothing matches', () => {
    const out = applyClientFilter(
      { ...base, clientFilters: [{ field: 'state', value: 'blocked' }] },
      body,
    )
    expect(JSON.parse(out)).toEqual([])
  })

  it('passes through a non-array body (e.g. a host error object)', () => {
    const err = JSON.stringify({ error: { code: 'not_found' } })
    expect(
      applyClientFilter(
        { ...base, clientFilters: [{ field: 'state', value: 'open' }] },
        err,
      ),
    ).toBe(err)
  })

  it('passes through unparseable bodies without throwing', () => {
    expect(
      applyClientFilter(
        { ...base, clientFilters: [{ field: 'state', value: 'open' }] },
        'not json',
      ),
    ).toBe('not json')
  })
})
