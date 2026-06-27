/** @Acp.App.Server.RpcEndpoint.Test — POST /rpc over the in-process router */
import { describe, expect, it } from 'vitest'
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

const rpc = (body: unknown, token?: string) =>
  new Request('http://acp.test/rpc', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  })

describe('POST /rpc', () => {
  it('round-trips session.initialize then a scoped work.create', async () => {
    const handler = makeHandler()

    const initRes = await handler(
      rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: { worker, permissions: ['work:create'] },
      }),
    )
    expect(initRes.status).toBe(200)
    const init = (await initRes.json()) as {
      id: number
      result: { session_id: string; protocol_version: string }
    }
    expect(init.id).toBe(1)
    expect(init.result.session_id).toMatch(/^session_/)
    expect(init.result.protocol_version).toBe('0.1')

    const workRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'work.create',
          params: { workspace_id: 'workspace_1', title: 'Fix login redirect' },
        },
        init.result.session_id,
      ),
    )
    expect(workRes.status).toBe(200)
    const work = (await workRes.json()) as {
      result: { state: string; created_by: string }
    }
    expect(work.result.state).toBe('open')
    expect(work.result.created_by).toBe('agent_claude_code')
  })

  it('shares one store with the REST surface (a /rpc session authorizes a /v1 call)', async () => {
    const handler = makeHandler()
    const initRes = await handler(
      rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: { worker, permissions: ['work:create'] },
      }),
    )
    const token = ((await initRes.json()) as { result: { session_id: string } })
      .result.session_id

    const direct = await handler(
      new Request('http://acp.test/v1/work', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workspace_id: 'workspace_1', title: 'Direct' }),
      }),
    )
    expect(direct.status).toBe(201)
    expect(((await direct.json()) as { created_by: string }).created_by).toBe(
      'agent_claude_code',
    )
  })

  it('publishes work progress through JSON-RPC', async () => {
    const handler = makeHandler()
    const initRes = await handler(
      rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: { worker, permissions: ['work:create'] },
      }),
    )
    const token = ((await initRes.json()) as { result: { session_id: string } })
      .result.session_id

    const createRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'work.create',
          params: { workspace_id: 'workspace_1', title: 'Publish progress' },
        },
        token,
      ),
    )
    const workId = ((await createRes.json()) as { result: { id: string } })
      .result.id

    const eventRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'work.publish_event',
          params: {
            work_id: workId,
            type: 'work.progressed',
            data: { message: 'Progress from JSON-RPC' },
          },
        },
        token,
      ),
    )

    expect(eventRes.status).toBe(200)
    const event = (await eventRes.json()) as {
      result: { type: string; work_id: string; data: { message: string } }
    }
    expect(event.result.type).toBe('work.progressed')
    expect(event.result.work_id).toBe(workId)
    expect(event.result.data.message).toBe('Progress from JSON-RPC')
  })

  it('approves a requested review through JSON-RPC', async () => {
    const handler = makeHandler()
    const initRes = await handler(
      rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: {
          worker,
          permissions: ['work:create', 'work:claim', 'review:create'],
        },
      }),
    )
    const token = ((await initRes.json()) as { result: { session_id: string } })
      .result.session_id

    const createRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'work.create',
          params: { workspace_id: 'workspace_1', title: 'Reviewable work' },
        },
        token,
      ),
    )
    const workId = ((await createRes.json()) as { result: { id: string } })
      .result.id

    await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 'claim',
          method: 'work.claim',
          params: { work_id: workId, worker_id: 'agent_claude_code' },
        },
        token,
      ),
    )
    await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 'running',
          method: 'work.update',
          params: { work_id: workId, state: 'running' },
        },
        token,
      ),
    )

    const requestRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'review.request',
          params: {
            work_id: workId,
            requested_by: 'agent_claude_code',
            requirements: ['tests_pass'],
          },
        },
        token,
      ),
    )
    const reviewId = ((await requestRes.json()) as { result: { id: string } })
      .result.id

    const approveRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'review.approve',
          params: {
            review_id: reviewId,
            met_requirements: ['tests_pass'],
          },
        },
        token,
      ),
    )

    expect(approveRes.status).toBe(200)
    const approved = (await approveRes.json()) as {
      result: { id: string; state: string }
    }
    expect(approved.result.id).toBe(reviewId)
    expect(approved.result.state).toBe('approved')
  })

  it('deletes an artifact through JSON-RPC', async () => {
    const handler = makeHandler()
    const initRes = await handler(
      rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'session.initialize',
        params: { worker, permissions: ['artifact:create'] },
      }),
    )
    const token = ((await initRes.json()) as { result: { session_id: string } })
      .result.session_id

    const createRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'artifact.create',
          params: {
            workspace_id: 'workspace_1',
            work_id: 'work_1',
            kind: 'markdown',
            content: 'Review notes',
          },
        },
        token,
      ),
    )
    const artifactId = ((await createRes.json()) as { result: { id: string } })
      .result.id

    const deleteRes = await handler(
      rpc(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'artifact.delete',
          params: { artifact_id: artifactId },
        },
        token,
      ),
    )

    expect(deleteRes.status).toBe(200)
    const deleted = (await deleteRes.json()) as {
      result: { id: string; kind: string }
    }
    expect(deleted.result.id).toBe(artifactId)
    expect(deleted.result.kind).toBe('markdown')
  })

  it('returns 204 with no body for a notification (no id)', async () => {
    const handler = makeHandler()
    const res = await handler(
      rpc({
        jsonrpc: '2.0',
        method: 'session.initialize',
        params: { worker, permissions: [] },
      }),
    )
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('executes a batch, returning only the non-notification responses', async () => {
    const handler = makeHandler()
    const res = await handler(
      rpc([
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'session.initialize',
          params: { worker, permissions: [] },
        },
        { jsonrpc: '2.0', id: 2, method: 'workspace.list' },
        { jsonrpc: '2.0', method: 'workspace.list' }, // notification → dropped
      ]),
    )
    expect(res.status).toBe(200)
    const batch = (await res.json()) as { id: number }[]
    expect(batch.map((r) => r.id).sort()).toEqual([1, 2])
  })

  it('reports an unknown method as a -32601 error (HTTP 200)', async () => {
    const handler = makeHandler()
    const res = await handler(
      rpc({ jsonrpc: '2.0', id: 9, method: 'work.teleport' }),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(
      -32601,
    )
  })

  it('reports a non-JSON body as a -32700 parse error', async () => {
    const handler = makeHandler()
    const res = await handler(
      new Request('http://acp.test/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json{',
      }),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(
      -32700,
    )
  })
})
