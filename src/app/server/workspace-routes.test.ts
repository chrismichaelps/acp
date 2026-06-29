/** @Acp.App.Server.WorkspaceRoutes.Test — workspace HTTP route behavior */
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
  capabilities: ['can_edit_files'],
}

const initSession = async (
  handler: (req: Request) => Promise<Response>,
  permissions: readonly string[],
) => {
  const res = await handler(
    new Request('http://acp.test/v1/session/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worker, permissions }),
    }),
  )
  return ((await res.json()) as { session_id: string }).session_id
}

const createWork = (token: string, workspaceId: string, title: string) =>
  new Request('http://acp.test/v1/work', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ workspace_id: workspaceId, title }),
  })

const postJson = (token: string, path: string, body: Record<string, unknown>) =>
  new Request(`http://acp.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

describe('workspace routes', () => {
  it('lists work units inside a workspace', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['workspace:read', 'work:create'])

    await handler(createWork(token, 'workspace_index', 'First indexed work'))
    await handler(createWork(token, 'workspace_other', 'Other work'))

    const listed = await handler(
      new Request('http://acp.test/v1/workspaces/workspace_index/work', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(listed.status).toBe(200)
    expect(
      ((await listed.json()) as { title: string }[]).map((work) => work.title),
    ).toEqual(['First indexed work'])
  })

  it('enforces workspace:read for workspace work indexes', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['work:create'])
    await handler(createWork(token, 'workspace_index', 'Private indexed work'))

    const denied = await handler(
      new Request('http://acp.test/v1/workspaces/workspace_index/work', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(denied.status).toBe(401)
  })

  it('lists workspace checkpoints, artifacts, and reviews', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'workspace:read',
      'work:create',
      'work:claim',
      'work:update',
      'checkpoint:create',
      'artifact:create',
      'review:create',
    ])

    const workResponse = await handler(
      createWork(token, 'workspace_resume', 'Resume aggregate work'),
    )
    const work = (await workResponse.json()) as { id: string }
    await handler(
      createWork(token, 'workspace_other', 'Filtered aggregate work'),
    )
    const claimResponse = await handler(
      postJson(token, `/v1/work/${work.id}/claim`, { worker_id: worker.id }),
    )
    const runningResponse = await handler(
      new Request(`http://acp.test/v1/work/${work.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ state: 'running' }),
      }),
    )

    const checkpointResponse = await handler(
      postJson(token, '/v1/checkpoints', {
        workspace_id: 'workspace_resume',
        work_id: work.id,
        summary: 'Ready to resume',
        completed_steps: [],
        remaining_steps: [],
        modified_resources: [],
      }),
    )
    const artifactResponse = await handler(
      postJson(token, '/v1/artifacts', {
        workspace_id: 'workspace_resume',
        work_id: work.id,
        kind: 'test_report',
        uri: 'https://example.com/reports/resume',
        summary: 'Resume evidence',
      }),
    )
    const reviewResponse = await handler(
      postJson(token, '/v1/reviews', {
        work_id: work.id,
        requested_by: worker.id,
        requirements: [],
      }),
    )
    expect(claimResponse.status).toBe(200)
    expect(runningResponse.status).toBe(200)
    expect(checkpointResponse.status).toBe(201)
    expect(artifactResponse.status).toBe(201)
    expect(reviewResponse.status).toBe(201)

    const checkpoints = await handler(
      new Request(
        'http://acp.test/v1/workspaces/workspace_resume/checkpoints',
        { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      ),
    )
    const artifacts = await handler(
      new Request('http://acp.test/v1/workspaces/workspace_resume/artifacts', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    const reviews = await handler(
      new Request('http://acp.test/v1/workspaces/workspace_resume/reviews', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(checkpoints.status).toBe(200)
    expect(artifacts.status).toBe(200)
    expect(reviews.status).toBe(200)
    expect(
      ((await checkpoints.json()) as { summary: string }[]).map(
        (checkpoint) => checkpoint.summary,
      ),
    ).toEqual(['Ready to resume'])
    expect(
      ((await artifacts.json()) as { summary: string }[]).map(
        (artifact) => artifact.summary,
      ),
    ).toEqual(['Resume evidence'])
    expect((await reviews.json()) as { work_id: string }[]).toEqual([
      expect.objectContaining({ work_id: work.id }),
    ])
  })

  it('enforces workspace:read for workspace aggregate reads', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['work:create'])
    await handler(createWork(token, 'workspace_index', 'Private indexed work'))

    const denied = await handler(
      new Request('http://acp.test/v1/workspaces/workspace_index/artifacts', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )

    expect(denied.status).toBe(401)
  })
})
