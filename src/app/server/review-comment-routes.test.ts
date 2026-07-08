/** @Acp.App.Server.ReviewCommentRoutes.Test — diff-anchored comment routes */
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

const initSession = async (handler: (req: Request) => Promise<Response>) => {
  const res = await handler(
    new Request('http://acp.test/v1/session/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        worker,
        permissions: [
          'workspace:read',
          'workspace:write',
          'work:create',
          'work:claim',
          'work:update',
          'review:create',
        ],
      }),
    }),
  )
  return ((await res.json()) as { session_id: string }).session_id
}

const authed = (token: string, path: string, body?: unknown, method = 'POST') =>
  new Request(`http://acp.test${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const requestReviewOn = async (
  handler: (req: Request) => Promise<Response>,
  token: string,
  workId: string,
) => {
  await handler(
    authed(token, `/v1/work/${workId}/claim`, { worker_id: worker.id }),
  )
  await handler(
    authed(token, `/v1/work/${workId}`, { state: 'running' }, 'PATCH'),
  )
  return handler(
    authed(token, '/v1/reviews', {
      work_id: workId,
      requested_by: worker.id,
      requirements: ['tests pass'],
    }),
  )
}

describe('review comment routes', () => {
  it('adds, lists, resolves, and reopens diff-anchored comments', async () => {
    const handler = makeHandler()
    const token = await initSession(handler)

    const work = (await (
      await handler(
        authed(token, '/v1/work', {
          workspace_id: 'workspace_1',
          title: 'Comment target',
        }),
      )
    ).json()) as { id: string; workspace_id: string }

    const review = (await (
      await requestReviewOn(handler, token, work.id)
    ).json()) as { id: string }

    const addRes = await handler(
      authed(token, `/v1/reviews/${review.id}/comments`, {
        review_id: review.id,
        work_id: work.id,
        workspace_id: work.workspace_id,
        target: {
          artifact_id: 'artifact_diff',
          file: 'src/app.ts',
          line: 42,
          side: 'new',
        },
        body: 'This branch is never taken.',
      }),
    )
    expect(addRes.status).toBe(201)
    const comment = (await addRes.json()) as { id: string; state: string }
    expect(comment.state).toBe('open')

    const listByReview = await handler(
      authed(token, `/v1/reviews/${review.id}/comments`, undefined, 'GET'),
    )
    expect(listByReview.status).toBe(200)
    expect((await listByReview.json()) as unknown[]).toHaveLength(1)

    const listByWork = await handler(
      authed(token, `/v1/work/${work.id}/review-comments`, undefined, 'GET'),
    )
    expect(listByWork.status).toBe(200)
    expect((await listByWork.json()) as unknown[]).toHaveLength(1)

    const resolved = await handler(
      authed(token, `/v1/review-comments/${comment.id}/resolve`),
    )
    expect(resolved.status).toBe(200)
    expect(((await resolved.json()) as { state: string }).state).toBe(
      'resolved',
    )

    const reopened = await handler(
      authed(token, `/v1/review-comments/${comment.id}/reopen`),
    )
    expect(reopened.status).toBe(200)
    expect(((await reopened.json()) as { state: string }).state).toBe('open')
  })
})
