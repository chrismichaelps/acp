/** @Acp.App.Server.ResumeWorkspaceRoutes.Test — ETag revalidation + budgeted resume reads */
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

const post = (token: string, path: string, body: unknown) =>
  new Request(`http://acp.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

const get = (
  handler: (req: Request) => Promise<Response>,
  token: string,
  path: string,
  headers: Record<string, string> = {},
) =>
  handler(
    new Request(`http://acp.test${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, ...headers },
    }),
  )

const setupWork = async (
  handler: (req: Request) => Promise<Response>,
  token: string,
) => {
  const created = await handler(
    post(token, '/v1/work', {
      workspace_id: 'workspace_1',
      title: 'Budgeted resume',
    }),
  )
  return (await created.json()) as { id: string; workspace_id: string }
}

const addArtifact = (
  handler: (req: Request) => Promise<Response>,
  token: string,
  work: { id: string; workspace_id: string },
  name: string,
) =>
  handler(
    post(token, '/v1/artifacts', {
      workspace_id: work.workspace_id,
      work_id: work.id,
      kind: 'pull_request',
      uri: `https://example.com/acp/${name}`,
      summary: name,
    }),
  )

describe('resume packet as a global workspace', () => {
  it('returns an ETag and serves 304 to a matching If-None-Match', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['workspace:read', 'work:create'])
    const work = await setupWork(handler, token)

    const first = await get(handler, token, `/v1/work/${work.id}/resume`)
    expect(first.status).toBe(200)
    const etag = first.headers.get('etag') ?? ''
    expect(etag).not.toBe('')

    const revalidated = await get(
      handler,
      token,
      `/v1/work/${work.id}/resume`,
      {
        'if-none-match': etag,
      },
    )
    expect(revalidated.status).toBe(304)
    expect(await revalidated.text()).toBe('')
    expect(revalidated.headers.get('etag')).toBe(etag)
  })

  it('busts the ETag when the work state changes', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'workspace:read',
      'work:create',
      'artifact:create',
    ])
    const work = await setupWork(handler, token)
    const before =
      (await get(handler, token, `/v1/work/${work.id}/resume`)).headers.get(
        'etag',
      ) ?? ''

    await addArtifact(handler, token, work, 'pr-1')
    const after = await get(handler, token, `/v1/work/${work.id}/resume`)
    expect(after.status).toBe(200)
    expect(after.headers.get('etag')).not.toBe(before)
  })

  it('bounds inline artifacts under ?budget and elides the rest to refs', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'workspace:read',
      'work:create',
      'artifact:create',
    ])
    const work = await setupWork(handler, token)
    for (const name of ['pr-1', 'pr-2', 'pr-3']) {
      await addArtifact(handler, token, work, name)
    }

    const res = await get(handler, token, `/v1/work/${work.id}/resume?budget=2`)
    expect(res.status).toBe(200)
    const packet = (await res.json()) as {
      artifacts: unknown[]
      elided?: { artifacts?: { count: number; ids: string[] } }
    }
    expect(packet.artifacts).toHaveLength(2)
    expect(packet.elided?.artifacts?.count).toBe(1)
    expect(packet.elided?.artifacts?.ids).toHaveLength(1)

    // A budgeted read carries its own ETag and the full read still inlines all 3.
    const full = await get(handler, token, `/v1/work/${work.id}/resume`)
    expect(full.headers.get('etag')).not.toBe(res.headers.get('etag'))
    const fullPacket = (await full.json()) as { artifacts: unknown[] }
    expect(fullPacket.artifacts).toHaveLength(3)
  })
})
