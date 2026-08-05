/** @Acp.App.Server.WorkGraphRoutes.Test — spawn graph over HTTP */
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

const json = async (res: Response): Promise<unknown> => res.json()

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files'],
}

/** Registers a worker and workspace, returning the workspace id. */
const bootstrap = async (handler: Handler): Promise<string> => {
  await handler(request('POST', '/v1/session/initialize', { worker }))
  const res = await handler(
    request('POST', '/v1/workspaces', {
      name: 'graph',
      kind: 'git_repository',
      uri: 'file:///tmp/graph',
    }),
  )
  const created = (await json(res)) as { id: string }
  return created.id
}

const createWork = async (
  handler: Handler,
  workspaceId: string,
  title: string,
  parentId?: string,
): Promise<Response> =>
  handler(
    request('POST', '/v1/work', {
      workspace_id: workspaceId,
      title,
      ...(parentId === undefined ? {} : { parent_id: parentId }),
    }),
  )

/** Drives a work unit from `open` to `running`, the child-accepting state. */
const toRunning = async (handler: Handler, workId: string): Promise<void> => {
  await handler(
    request('POST', `/v1/work/${workId}/claim`, { worker_id: worker.id }),
  )
  await handler(request('PATCH', `/v1/work/${workId}`, { state: 'running' }))
}

describe('spawn graph over HTTP', () => {
  it('creates a child, then lists it under its parent', async () => {
    const handler = makeHandler()
    const workspaceId = await bootstrap(handler)

    const parent = (await json(
      await createWork(handler, workspaceId, 'parent'),
    )) as { id: string; depth: number; parent_id?: string }
    expect(parent.depth).toBe(0)
    // A None Option is omitted from the wire shape, matching `assigned_to`.
    expect(parent.parent_id).toBeUndefined()
    await toRunning(handler, parent.id)

    const childRes = await createWork(handler, workspaceId, 'child', parent.id)
    expect(childRes.status).toBe(201)
    const child = (await json(childRes)) as {
      id: string
      depth: number
      parent_id: string
    }
    expect(child.depth).toBe(1)
    expect(child.parent_id).toBe(parent.id)

    const listed = await handler(
      request('GET', `/v1/work/${parent.id}/children`),
    )
    expect(listed.status).toBe(200)
    expect(((await json(listed)) as { id: string }[]).map((w) => w.id)).toEqual(
      [child.id],
    )
  })

  it('lists descendants breadth-first', async () => {
    const handler = makeHandler()
    const workspaceId = await bootstrap(handler)
    const root = (await json(
      await createWork(handler, workspaceId, 'root'),
    )) as { id: string }
    await toRunning(handler, root.id)
    const child = (await json(
      await createWork(handler, workspaceId, 'child', root.id),
    )) as { id: string }
    await toRunning(handler, child.id)
    const grandchild = (await json(
      await createWork(handler, workspaceId, 'grandchild', child.id),
    )) as { id: string }

    const res = await handler(request('GET', `/v1/work/${root.id}/descendants`))
    expect(res.status).toBe(200)
    const ids = ((await json(res)) as { id: string }[]).map((w) => w.id)
    expect(ids).toEqual([child.id, grandchild.id])

    const bounded = await handler(
      request('GET', `/v1/work/${root.id}/descendants?max_depth=1`),
    )
    expect(
      ((await json(bounded)) as { id: string }[]).map((w) => w.id),
    ).toEqual([child.id])
  })

  it('rejects a non-positive descendant bound with 400', async () => {
    const handler = makeHandler()
    const workspaceId = await bootstrap(handler)
    const root = (await json(
      await createWork(handler, workspaceId, 'root'),
    )) as { id: string }

    const res = await handler(
      request('GET', `/v1/work/${root.id}/descendants?limit=0`),
    )
    expect(res.status).toBe(400)
  })

  it('refuses needs_review with 409 while a child is unfinished', async () => {
    const handler = makeHandler()
    const workspaceId = await bootstrap(handler)
    const parent = (await json(
      await createWork(handler, workspaceId, 'parent'),
    )) as { id: string }
    await toRunning(handler, parent.id)
    const child = (await json(
      await createWork(handler, workspaceId, 'child', parent.id),
    )) as { id: string }

    const blocked = await handler(
      request('PATCH', `/v1/work/${parent.id}`, { state: 'needs_review' }),
    )
    expect(blocked.status).toBe(409)
    const body = (await json(blocked)) as {
      error: {
        code: string
        // `details` is an encoded Option envelope, not a bare object.
        details: { value: { blocking_children: string[] } }
      }
    }
    expect(body.error.code).toBe('conflict')
    expect(body.error.details.value.blocking_children).toEqual([child.id])

    // Terminating the child releases the gate.
    await handler(
      request('PATCH', `/v1/work/${child.id}`, { state: 'cancelled' }),
    )
    const allowed = await handler(
      request('PATCH', `/v1/work/${parent.id}`, { state: 'needs_review' }),
    )
    expect(allowed.status).toBe(200)
  })

  it('returns 404 for children of unknown work', async () => {
    const handler = makeHandler()
    await bootstrap(handler)
    const res = await handler(request('GET', '/v1/work/work_absent/children'))
    expect(res.status).toBe(404)
  })
})
