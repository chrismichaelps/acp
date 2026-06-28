/** @Acp.App.Server.ArtifactRoutes.Test — artifact HTTP route behavior */
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

const createArtifact = (token: string) =>
  new Request('http://acp.test/v1/artifacts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      workspace_id: 'workspace_1',
      work_id: 'work_1',
      kind: 'markdown',
      content: 'Review notes',
    }),
  })

describe('artifact routes', () => {
  it('updates an artifact and preserves its identity fields', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['artifact:create'])
    const created = await handler(createArtifact(token))
    const artifact = (await created.json()) as {
      id: string
      uri: string
      created_at: string
      created_by: string
    }

    const updated = await handler(
      new Request(`http://acp.test/v1/artifacts/${artifact.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          kind: 'log',
          summary: 'Updated artifact',
          content: 'Updated content',
        }),
      }),
    )

    expect(updated.status).toBe(200)
    const body = (await updated.json()) as {
      id: string
      uri: string
      kind: string
      created_at: string
      created_by: string
      summary: string
    }
    expect(body.id).toBe(artifact.id)
    expect(body.uri).toBe(artifact.uri)
    expect(body.created_at).toBe(artifact.created_at)
    expect(body.created_by).toBe(artifact.created_by)
    expect(body.kind).toBe('log')
    expect(body.summary).toBe('Updated artifact')
  })

  it('deletes an artifact and returns 404 on a repeated delete', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['artifact:create'])
    const created = await handler(createArtifact(token))
    expect(created.status).toBe(201)
    const artifactId = ((await created.json()) as { id: string }).id

    const deleted = await handler(
      new Request(`http://acp.test/v1/artifacts/${artifactId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(deleted.status).toBe(200)
    expect(((await deleted.json()) as { id: string }).id).toBe(artifactId)

    const repeated = await handler(
      new Request(`http://acp.test/v1/artifacts/${artifactId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(repeated.status).toBe(404)
  })
})
