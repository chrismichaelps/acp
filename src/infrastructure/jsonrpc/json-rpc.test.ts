import { Either, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  jsonRpcError,
  jsonRpcSuccess,
  parseJsonRpcCommand,
} from './json-rpc.js'

const worker = {
  id: 'agent_codex',
  name: 'Codex',
  kind: 'agent',
  status: 'online',
  capabilities: [],
}

const expectRight = <A, E>(value: Either.Either<A, E>): A => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

const expectLeft = <A, E>(value: Either.Either<A, E>): E => {
  if (Either.isRight(value)) {
    throw new Error(`expected Left, got ${String(value.right)}`)
  }
  return value.left
}

const expectSome = <A>(value: Option.Option<A>): A => {
  if (Option.isNone(value)) {
    throw new Error('expected Some, got None')
  }
  return value.value
}

describe('JSON-RPC transport mapping', () => {
  it('maps session.initialize to the open HTTP bootstrap route', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_1',
        method: 'session.initialize',
        params: { worker, permissions: ['work:create'] },
      }),
    )

    expect(command.expects_response).toBe(true)
    expect(command.request).toMatchObject({
      method: 'POST',
      path: '/v1/session/initialize',
      body: {
        worker: {
          id: 'agent_codex',
          name: 'Codex',
          kind: 'agent',
          status: 'online',
          capabilities: [],
        },
        permissions: ['work:create'],
      },
      label: 'session.initialize',
    })
  })

  it('maps workspace.list without a request body', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 2,
        method: 'workspace.list',
      }),
    )

    expect(command.request).toEqual({
      method: 'GET',
      path: '/v1/workspaces',
      label: 'workspace.list',
    })
  })

  it('maps work.create params through the protocol schema', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_3',
        method: 'work.create',
        params: {
          workspace_id: 'workspace_main',
          title: 'Review lease handling',
          priority: 'high',
        },
      }),
    )

    expect(command.request).toMatchObject({
      method: 'POST',
      path: '/v1/work',
      label: 'work.create',
    })
    expect(command.request.body).toMatchObject({
      workspace_id: 'workspace_main',
      title: 'Review lease handling',
      priority: Option.some('high'),
    })
  })

  it('maps work.claim and encodes the work id path segment', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_4',
        method: 'work.claim',
        params: { work_id: 'work/needs encoding', worker_id: 'agent_codex' },
      }),
    )

    expect(command.request).toEqual({
      method: 'POST',
      path: '/v1/work/work%2Fneeds%20encoding/claim',
      body: { worker_id: 'agent_codex' },
      label: 'work.claim',
    })
  })

  it('maps events.subscribe to the SSE stream route', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_5',
        method: 'events.subscribe',
        params: { workspace_id: 'workspace/main' },
      }),
    )

    expect(command.request).toEqual({
      method: 'GET',
      path: '/v1/events/stream?workspace_id=workspace%2Fmain',
      stream: true,
      label: 'events.subscribe',
    })
  })

  it('returns method-not-found for unknown methods', () => {
    const failure = expectLeft(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_unknown',
        method: 'work.delete',
      }),
    )

    expect(expectSome(jsonRpcError(failure))).toEqual({
      jsonrpc: '2.0',
      id: 'rpc_unknown',
      error: {
        code: -32601,
        message: 'Method not found',
        data: { method: 'work.delete' },
      },
    })
  })

  it('returns invalid-params when required params are missing', () => {
    const failure = expectLeft(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_bad_params',
        method: 'lease.release',
        params: {},
      }),
    )

    const response = expectSome(jsonRpcError(failure))
    expect(response.error.code).toBe(-32602)
    expect(response.id).toBe('rpc_bad_params')
  })

  it('suppresses error responses for invalid notifications', () => {
    const failure = expectLeft(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        method: 'lease.release',
        params: {},
      }),
    )

    expect(jsonRpcError(failure)).toEqual(Option.none())
  })

  it('preserves id null as a response-bearing request id', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: null,
        method: 'workspace.list',
      }),
    )

    expect(command.expects_response).toBe(true)
    expect(jsonRpcSuccess(command, [])).toEqual(
      Option.some({ jsonrpc: '2.0', id: null, result: [] }),
    )
  })

  it('suppresses success responses for notifications', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        method: 'workspace.list',
      }),
    )

    expect(command.expects_response).toBe(false)
    expect(jsonRpcSuccess(command, [])).toEqual(Option.none())
  })

  it('returns invalid-request for non JSON-RPC 2.0 envelopes', () => {
    const failure = expectLeft(
      parseJsonRpcCommand({
        jsonrpc: '1.0',
        id: 'rpc_old',
        method: 'workspace.list',
      }),
    )

    const response = expectSome(jsonRpcError(failure))
    expect(response.error.code).toBe(-32600)
    expect(response.id).toBe(null)
  })
})
