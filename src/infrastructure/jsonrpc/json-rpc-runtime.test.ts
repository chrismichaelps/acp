/** @Acp.Infra.JsonRpc.Runtime.Test — command execution + JSON-RPC folding */
import { describe, expect, it } from 'vitest'
import { HttpApp } from '@effect/platform'
import { Effect, Layer, Option } from 'effect'
import { AppLive } from '../../app/index.js'
import { IdClockLive } from '../../app/server/index.js'
import { acpRouter } from '../../app/server/index.js'
import { executeJsonRpc } from './json-rpc-runtime.js'
import type {
  JsonRpcDispatch,
  JsonRpcDispatchResult,
} from './json-rpc-runtime.js'
import type { JsonRpcResponse } from './json-rpc.js'

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

// A dispatch that returns a fixed result and records what it was asked to run.
const stubDispatch = (
  result: JsonRpcDispatchResult,
  calls: { method: string; path: string }[] = [],
): JsonRpcDispatch => {
  const dispatch: JsonRpcDispatch = (request) => {
    calls.push({ method: request.method, path: request.path })
    return Effect.succeed(result)
  }
  return dispatch
}

// The real in-process dispatch: the acpRouter web handler over the full app.
const liveDispatch = (): JsonRpcDispatch => {
  const handler = HttpApp.toWebHandlerLayer(
    acpRouter,
    Layer.mergeAll(AppLive, IdClockLive),
  ).handler
  return (request, token) =>
    Effect.promise(async () => {
      const res = await handler(
        new Request(`http://acp.test${request.path}`, {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            ...(Option.isSome(token)
              ? { authorization: `Bearer ${token.value}` }
              : {}),
          },
          body:
            request.body === undefined
              ? undefined
              : JSON.stringify(request.body),
        }),
      )
      const body: unknown = res.status === 204 ? null : await res.json()
      return { status: res.status, body }
    })
}

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect)

describe('executeJsonRpc — folding rules', () => {
  it('correlates a request id to a success result', async () => {
    const out = await run(
      executeJsonRpc(
        stubDispatch({ status: 200, body: { ok: true } }),
        { jsonrpc: '2.0', id: 7, method: 'workspace.list' },
        Option.none(),
      ),
    )
    expect(Option.getOrNull(out)).toEqual({
      jsonrpc: '2.0',
      id: 7,
      result: { ok: true },
    })
  })

  it('suppresses any response for a notification (no id)', async () => {
    const calls: { method: string; path: string }[] = []
    const out = await run(
      executeJsonRpc(
        stubDispatch({ status: 201, body: { id: 'work_1' } }, calls),
        {
          jsonrpc: '2.0',
          method: 'work.create',
          params: { workspace_id: 'w', title: 't' },
        },
        Option.none(),
      ),
    )
    expect(Option.isNone(out)).toBe(true)
    expect(calls).toHaveLength(1) // still executed for its side effect
  })

  it('maps a 400 to -32602 and other non-2xx to -32603, keeping the ACP error as data', async () => {
    const bad = await run(
      executeJsonRpc(
        stubDispatch({
          status: 400,
          body: { error: { code: 'validation_error' } },
        }),
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'work.create',
          params: { workspace_id: 'w', title: 't' },
        },
        Option.none(),
      ),
    )
    expect(
      (Option.getOrNull(bad) as { error: { code: number } }).error.code,
    ).toBe(-32602)

    const missing = await run(
      executeJsonRpc(
        stubDispatch({ status: 404, body: { error: { code: 'not_found' } } }),
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'lease.release',
          params: { lease_id: 'lease_x' },
        },
        Option.none(),
      ),
    )
    const err = Option.getOrNull(missing) as {
      error: { code: number; data: unknown }
    }
    expect(err.error.code).toBe(-32603)
    expect(err.error.data).toEqual({ error: { code: 'not_found' } })
  })

  it('rejects an unknown method with -32601', async () => {
    const out = await run(
      executeJsonRpc(
        stubDispatch({ status: 200, body: null }),
        { jsonrpc: '2.0', id: 3, method: 'work.teleport' },
        Option.none(),
      ),
    )
    expect(
      (Option.getOrNull(out) as { error: { code: number } }).error.code,
    ).toBe(-32601)
  })

  it('rejects a stream method (events.subscribe) with -32603 before dispatch', async () => {
    const calls: { method: string; path: string }[] = []
    const out = await run(
      executeJsonRpc(
        stubDispatch({ status: 200, body: null }, calls),
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'events.subscribe',
          params: { workspace_id: 'w' },
        },
        Option.none(),
      ),
    )
    expect(
      (Option.getOrNull(out) as { error: { code: number } }).error.code,
    ).toBe(-32603)
    expect(calls).toHaveLength(0) // never dispatched
  })

  it('returns only sendable responses for a batch, and -32600 for an empty batch', async () => {
    const batch = await run(
      executeJsonRpc(
        stubDispatch({ status: 200, body: { ok: true } }),
        [
          { jsonrpc: '2.0', id: 1, method: 'workspace.list' },
          { jsonrpc: '2.0', method: 'workspace.list' }, // notification → suppressed
        ],
        Option.none(),
      ),
    )
    expect((Option.getOrNull(batch) as readonly JsonRpcResponse[]).length).toBe(
      1,
    )

    const empty = await run(
      executeJsonRpc(
        stubDispatch({ status: 200, body: null }),
        [],
        Option.none(),
      ),
    )
    expect(
      (Option.getOrNull(empty) as { error: { code: number } }).error.code,
    ).toBe(-32600)
  })
})

describe('executeJsonRpc — over the live router', () => {
  it('round-trips session.initialize then a scoped work.create', async () => {
    const dispatch = liveDispatch()

    const init = await run(
      executeJsonRpc(
        dispatch,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'session.initialize',
          params: { worker, permissions: ['work:create'] },
        },
        Option.none(),
      ),
    )
    const session = (
      Option.getOrNull(init) as { result: { session_id: string } }
    ).result
    expect(session.session_id).toMatch(/^session_[0-9a-f]{64}$/)

    const created = await run(
      executeJsonRpc(
        dispatch,
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'work.create',
          params: { workspace_id: 'workspace_1', title: 'Fix login redirect' },
        },
        Option.some(session.session_id),
      ),
    )
    const work = (
      Option.getOrNull(created) as {
        result: { state: string; created_by: string }
      }
    ).result
    expect(work.state).toBe('open')
    expect(work.created_by).toBe('agent_claude_code')
  })

  it('surfaces a scope denial (403 forbidden) as a -32603 error', async () => {
    const dispatch = liveDispatch()

    const init = await run(
      executeJsonRpc(
        dispatch,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'session.initialize',
          params: { worker, permissions: ['review:create'] },
        },
        Option.none(),
      ),
    )
    const token = (Option.getOrNull(init) as { result: { session_id: string } })
      .result.session_id

    const denied = await run(
      executeJsonRpc(
        dispatch,
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'work.create',
          params: { workspace_id: 'workspace_1', title: 'Nope' },
        },
        Option.some(token),
      ),
    )
    expect(
      (Option.getOrNull(denied) as { error: { code: number } }).error.code,
    ).toBe(-32603)
  })
})
