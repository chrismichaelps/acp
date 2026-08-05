/** @Acp.App.Server.EventTailRoutes.Test — ?tail= over HTTP */
import { describe, expect, it } from 'vitest'
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

type Handler = ReturnType<typeof makeHandler>

const request = (method: string, path: string, body?: unknown) =>
  new Request(`http://acp.test${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files'],
}

/** Registers a worker and workspace, then creates `count` work units. */
const seed = async (
  handler: Handler,
  count: number,
): Promise<{ workspaceId: string }> => {
  await handler(request('POST', '/v1/session/initialize', { worker }))
  const created = (await (
    await handler(
      request('POST', '/v1/workspaces', {
        name: 'tail',
        kind: 'git_repository',
        uri: 'file:///tmp/tail',
      }),
    )
  ).json()) as { id: string }
  for (let n = 1; n <= count; n += 1) {
    await handler(
      request('POST', '/v1/work', {
        workspace_id: created.id,
        title: `Task ${String(n)}`,
      }),
    )
  }
  return { workspaceId: created.id }
}

const seqs = async (res: Response): Promise<number[]> =>
  ((await res.json()) as { seq: number }[]).map((event) => event.seq)

describe('event tail reads over HTTP', () => {
  it('returns the newest events, ascending by seq', async () => {
    const handler = makeHandler()
    const { workspaceId } = await seed(handler, 5)

    const all = await seqs(
      await handler(request('GET', `/v1/events?workspace_id=${workspaceId}`)),
    )
    const tail = await seqs(
      await handler(
        request('GET', `/v1/events?workspace_id=${workspaceId}&tail=2`),
      ),
    )

    expect(tail).toEqual(all.slice(-2))
    expect(tail).toEqual([...tail].sort((a, b) => a - b))
  })

  it('returns the whole log when tail exceeds its length', async () => {
    const handler = makeHandler()
    const { workspaceId } = await seed(handler, 2)
    // Workspace creation emits its own event, so the log is longer than the
    // work units seeded; compare against the full read rather than a count.
    const all = await seqs(
      await handler(request('GET', `/v1/events?workspace_id=${workspaceId}`)),
    )
    const tail = await seqs(
      await handler(
        request('GET', `/v1/events?workspace_id=${workspaceId}&tail=50`),
      ),
    )
    expect(tail).toEqual(all)
  })

  it('rejects tail combined with after_seq', async () => {
    const handler = makeHandler()
    const { workspaceId } = await seed(handler, 3)
    const res = await handler(
      request(
        'GET',
        `/v1/events?workspace_id=${workspaceId}&tail=2&after_seq=1`,
      ),
    )
    expect(res.status).toBe(400)
  })

  it('rejects a non-positive tail', async () => {
    const handler = makeHandler()
    const { workspaceId } = await seed(handler, 3)
    const res = await handler(
      request('GET', `/v1/events?workspace_id=${workspaceId}&tail=0`),
    )
    expect(res.status).toBe(400)
  })

  it('leaves the cursor read unchanged when tail is absent', async () => {
    const handler = makeHandler()
    const { workspaceId } = await seed(handler, 4)
    const after = await seqs(
      await handler(
        request('GET', `/v1/events?workspace_id=${workspaceId}&after_seq=2`),
      ),
    )
    expect(after.every((seq) => seq > 2)).toBe(true)
  })
})
