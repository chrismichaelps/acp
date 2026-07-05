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
  workspaceIds?: readonly string[],
) => {
  const res = await handler(
    new Request('http://acp.test/v1/session/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        worker,
        permissions,
        ...(workspaceIds === undefined ? {} : { workspace_ids: workspaceIds }),
      }),
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
      'review:create',
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
    const storedArtifact = await handler(
      authedJson(token, '/v1/artifacts', {
        workspace_id: work.workspace_id,
        work_id: work.id,
        kind: 'markdown',
        content: 'Resume notes',
      }),
    )
    const artifact = (await storedArtifact.json()) as { id: string }
    await handler(
      authedJson(token, '/v1/reviews', {
        work_id: work.id,
        requested_by: worker.id,
        requirements: ['diff_review'],
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
    expect(
      ((await artifacts.json()) as { uri: string }[]).map(
        (listed) => listed.uri,
      ),
    ).toEqual(
      expect.arrayContaining([
        'https://example.com/acp/artifacts/pr-7',
        `acp://artifacts/${artifact.id}`,
      ]),
    )

    const reviews = await handler(
      new Request(`http://acp.test/v1/work/${work.id}/reviews`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(reviews.status).toBe(200)
    expect(
      (await reviews.json()) as { requirements: string[] }[],
    ).toMatchObject([{ requirements: ['diff_review'] }])

    const content = await handler(
      new Request(`http://acp.test/v1/artifacts/${artifact.id}/content`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(content.status).toBe(200)
    expect((await content.json()) as { content: string }).toEqual({
      content: 'Resume notes',
    })

    const packet = await handler(
      new Request(`http://acp.test/v1/work/${work.id}/resume`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(packet.status).toBe(200)
    const resume = (await packet.json()) as {
      artifacts: { uri: string }[]
      latest_checkpoint: { summary: string }
      reviews: { requirements: string[] }[]
      work: { id: string; title: string }
    }
    expect(resume.work).toMatchObject({
      id: work.id,
      title: 'Resume handoff',
    })
    expect(resume.latest_checkpoint.summary).toBe('Second checkpoint')
    expect(resume.artifacts.map((listed) => listed.uri)).toEqual(
      expect.arrayContaining([
        'https://example.com/acp/artifacts/pr-7',
        `acp://artifacts/${artifact.id}`,
      ]),
    )
    expect(resume.reviews).toMatchObject([{ requirements: ['diff_review'] }])
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
    expect(denied.status).toBe(403)
  })

  it('rejects resume reads outside the session workspace binding', async () => {
    const handler = makeHandler()
    const writer = await initSession(handler, ['work:create'])
    const reader = await initSession(
      handler,
      ['workspace:read'],
      ['workspace_other'],
    )
    const created = await handler(
      authedJson(writer, '/v1/work', {
        workspace_id: 'workspace_1',
        title: 'Workspace-bound private work',
      }),
    )
    const work = (await created.json()) as { id: string }

    const denied = await handler(
      new Request(`http://acp.test/v1/work/${work.id}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${reader}` },
      }),
    )
    expect(denied.status).toBe(403)
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

  it('returns 404 for external artifact content', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'workspace:read',
      'work:create',
      'artifact:create',
    ])
    const createdWork = await handler(
      authedJson(token, '/v1/work', {
        workspace_id: 'workspace_1',
        title: 'External artifact',
      }),
    )
    const work = (await createdWork.json()) as {
      id: string
      workspace_id: string
    }
    const createdArtifact = await handler(
      authedJson(token, '/v1/artifacts', {
        workspace_id: work.workspace_id,
        work_id: work.id,
        kind: 'pull_request',
        uri: 'https://example.com/acp/pull/9',
      }),
    )
    const artifact = (await createdArtifact.json()) as { id: string }

    const content = await handler(
      new Request(`http://acp.test/v1/artifacts/${artifact.id}/content`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(content.status).toBe(404)
  })
})
