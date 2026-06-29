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

  it('accepts the spec session.initialize capability shape', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_capabilities',
        method: 'session.initialize',
        params: {
          protocol_version: '0.1',
          worker: {
            id: 'agent_openhands',
            name: 'OpenHands',
            kind: 'agent',
            vendor: 'openhands',
          },
          capabilities: {
            can_edit_files: true,
            can_run_commands: true,
            can_create_prs: false,
            can_review: true,
            supports_checkpoints: true,
            supports_leases: true,
          },
          permissions: ['work:create'],
        },
      }),
    )

    expect(command.request).toMatchObject({
      method: 'POST',
      path: '/v1/session/initialize',
      body: {
        protocol_version: '0.1',
        worker: {
          id: 'agent_openhands',
          name: 'OpenHands',
          kind: 'agent',
          vendor: 'openhands',
        },
        capabilities: {
          can_edit_files: true,
          can_run_commands: true,
          can_create_prs: false,
          can_review: true,
          supports_checkpoints: true,
          supports_leases: true,
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

  it('maps workspace.create params through the protocol schema', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_workspace_create',
        method: 'workspace.create',
        params: {
          name: 'example/workspace',
          kind: 'git_repository',
          uri: 'git+https://example.com/workspaces/main.git',
          default_branch: 'main',
          metadata: { provider: 'github' },
        },
      }),
    )

    expect(command.request).toMatchObject({
      method: 'POST',
      path: '/v1/workspaces',
      label: 'workspace.create',
      body: {
        name: 'example/workspace',
        kind: 'git_repository',
        uri: 'git+https://example.com/workspaces/main.git',
        default_branch: 'main',
        metadata: { provider: 'github' },
      },
    })
  })

  it('maps workspace.update and encodes the workspace id path segment', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_workspace_update',
        method: 'workspace.update',
        params: {
          workspace_id: 'workspace/main',
          name: 'example/workspace-renamed',
          kind: 'git_repository',
          uri: 'git+https://example.com/workspaces/main.git',
          metadata: { provider: 'github' },
        },
      }),
    )

    expect(command.request).toEqual({
      method: 'PATCH',
      path: '/v1/workspaces/workspace%2Fmain',
      label: 'workspace.update',
      body: {
        name: 'example/workspace-renamed',
        kind: 'git_repository',
        uri: 'git+https://example.com/workspaces/main.git',
        default_branch: null,
        metadata: { provider: 'github' },
      },
    })
  })

  it('maps workspace.archive and encodes the workspace id path segment', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_workspace_archive',
        method: 'workspace.archive',
        params: { workspace_id: 'workspace/main' },
      }),
    )

    expect(command.request).toEqual({
      method: 'POST',
      path: '/v1/workspaces/workspace%2Fmain/archive',
      label: 'workspace.archive',
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
    // The body is the validated wire form (serializable onto the HTTP API), not
    // the decoded Type side — optionals stay as plain JSON, not Option wrappers.
    expect(command.request.body).toMatchObject({
      workspace_id: 'workspace_main',
      title: 'Review lease handling',
      priority: 'high',
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

  it('maps work.publish_event to the progress event route', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_progress',
        method: 'work.publish_event',
        params: {
          work_id: 'work/progress',
          type: 'work.progressed',
          data: { message: 'Added failing regression test' },
        },
      }),
    )

    expect(command.request).toEqual({
      method: 'POST',
      path: '/v1/work/work%2Fprogress/events',
      body: {
        type: 'work.progressed',
        data: { message: 'Added failing regression test' },
      },
      label: 'work.publish_event',
    })
  })

  it('maps artifact.delete and encodes the artifact id path segment', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_artifact_delete',
        method: 'artifact.delete',
        params: { artifact_id: 'artifact/needs encoding' },
      }),
    )

    expect(command.request).toEqual({
      method: 'DELETE',
      path: '/v1/artifacts/artifact%2Fneeds%20encoding',
      label: 'artifact.delete',
    })
  })

  it('maps artifact.update and encodes the artifact id path segment', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_artifact_update',
        method: 'artifact.update',
        params: {
          artifact_id: 'artifact/needs encoding',
          kind: 'markdown',
          uri: 'https://example.com/acp/artifacts/pull-42',
          summary: 'Updated notes',
          content: 'Updated content',
        },
      }),
    )

    expect(command.request).toEqual({
      method: 'PATCH',
      path: '/v1/artifacts/artifact%2Fneeds%20encoding',
      body: {
        kind: 'markdown',
        uri: 'https://example.com/acp/artifacts/pull-42',
        media_type: null,
        summary: 'Updated notes',
        content: 'Updated content',
      },
      label: 'artifact.update',
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

  it('maps review action methods to review routes', () => {
    const approve = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_review_approve',
        method: 'review.approve',
        params: {
          review_id: 'review/needs encoding',
          met_requirements: ['tests_pass'],
        },
      }),
    )
    expect(approve.request).toEqual({
      method: 'POST',
      path: '/v1/reviews/review%2Fneeds%20encoding/approve',
      body: { met_requirements: ['tests_pass'] },
      label: 'review.approve',
    })

    const reject = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_review_reject',
        method: 'review.reject',
        params: { review_id: 'review_main' },
      }),
    )
    expect(reject.request).toEqual({
      method: 'POST',
      path: '/v1/reviews/review_main/reject',
      label: 'review.reject',
    })

    const requestChanges = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_review_changes',
        method: 'review.request_changes',
        params: { review_id: 'review_main' },
      }),
    )
    expect(requestChanges.request).toEqual({
      method: 'POST',
      path: '/v1/reviews/review_main/request_changes',
      label: 'review.request_changes',
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
