/** @Acp.App.Server.ResumeRoutes.Test — work handoff read routes */
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
  capabilities: ['can_edit_files', 'supports_checkpoints'],
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

const authedJson = (
  token: string,
  path: string,
  body: unknown,
  method = 'POST',
) =>
  new Request(`http://acp.test${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

describe('resume routes', () => {
  it('returns work metadata, checkpoints, latest checkpoint, and artifacts', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'workspace:read',
      'work:create',
      'checkpoint:create',
      'artifact:create',
    ])

    const createdWork = await handler(
      authedJson(token, '/v1/work', {
        workspace_id: 'workspace_1',
        title: 'Resume handoff',
      }),
    )
    const work = (await createdWork.json()) as {
      id: string
      workspace_id: string
      title: string
    }

    await handler(
      authedJson(token, '/v1/checkpoints', {
        workspace_id: work.workspace_id,
        work_id: work.id,
        summary: 'First checkpoint',
        completed_steps: ['read code'],
        remaining_steps: ['write tests'],
        modified_resources: ['file://src/app.ts'],
      }),
    )
    await handler(
      authedJson(token, '/v1/checkpoints', {
        workspace_id: work.workspace_id,
        work_id: work.id,
        summary: 'Second checkpoint',
        completed_steps: ['read code', 'write tests'],
        remaining_steps: ['ship'],
        modified_resources: ['file://src/app.ts'],
      }),
    )
    await handler(
      authedJson(token, '/v1/artifacts', {
        workspace_id: work.workspace_id,
        work_id: work.id,
        kind: 'pull_request',
        uri: 'https://example.com/acp/artifacts/pr-7',
        summary: 'Review PR',
      }),
    )

    const readWork = await handler(
      new Request(`http://acp.test/v1/work/${work.id}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(readWork.status).toBe(200)
    expect(((await readWork.json()) as { title: string }).title).toBe(
      'Resume handoff',
    )

    const checkpoints = await handler(
      new Request(`http://acp.test/v1/work/${work.id}/checkpoints`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(checkpoints.status).toBe(200)
    const checkpointList = (await checkpoints.json()) as {
      summary: string
    }[]
    expect(checkpointList.map((checkpoint) => checkpoint.summary)).toEqual([
      'Second checkpoint',
      'First checkpoint',
    ])

    const latest = await handler(
      new Request(`http://acp.test/v1/work/${work.id}/checkpoints/latest`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(latest.status).toBe(200)
    expect(((await latest.json()) as { summary: string }).summary).toBe(
      'Second checkpoint',
    )

    const artifacts = await handler(
      new Request(`http://acp.test/v1/work/${work.id}/artifacts`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(artifacts.status).toBe(200)
    expect((await artifacts.json()) as { uri: string }[]).toMatchObject([
      { uri: 'https://example.com/acp/artifacts/pr-7' },
    ])
  })

  it('enforces workspace:read for bearer-authenticated resume reads', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['work:create'])
    const created = await handler(
      authedJson(token, '/v1/work', {
        workspace_id: 'workspace_1',
        title: 'Private work',
      }),
    )
    const work = (await created.json()) as { id: string }

    const denied = await handler(
      new Request(`http://acp.test/v1/work/${work.id}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(denied.status).toBe(401)
  })

  it('returns 404 for latest checkpoint when work has none', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['workspace:read', 'work:create'])
    const created = await handler(
      authedJson(token, '/v1/work', {
        workspace_id: 'workspace_1',
        title: 'No checkpoint yet',
      }),
    )
    const work = (await created.json()) as { id: string }

    const latest = await handler(
      new Request(`http://acp.test/v1/work/${work.id}/checkpoints/latest`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(latest.status).toBe(404)
  })
})
