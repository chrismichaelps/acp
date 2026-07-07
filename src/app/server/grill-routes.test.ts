/** @Acp.App.Server.GrillRoutes.Test — forced senior-question gate routes */
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
  capabilities: ['can_review'],
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

const jsonOf = async <T>(res: Response) => (await res.json()) as T

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
      requirements: ['answer the hard questions'],
    }),
  )
}

describe('grill routes', () => {
  it('runs an open→ask→answer→verdict→evaluate gate to a pass', async () => {
    const handler = makeHandler()
    const token = await initSession(handler)

    const work = await jsonOf<{ id: string; workspace_id: string }>(
      await handler(
        authed(token, '/v1/work', {
          workspace_id: 'workspace_1',
          title: 'Grill target',
        }),
      ),
    )
    const review = await jsonOf<{ id: string }>(
      await requestReviewOn(handler, token, work.id),
    )

    const openRes = await handler(
      authed(token, `/v1/reviews/${review.id}/grill`, {
        review_id: review.id,
        work_id: work.id,
        workspace_id: work.workspace_id,
      }),
    )
    expect(openRes.status).toBe(201)
    const grill = await jsonOf<{ id: string; state: string }>(openRes)
    expect(grill.state).toBe('open')

    const listGrills = await handler(
      authed(token, `/v1/reviews/${review.id}/grills`, undefined, 'GET'),
    )
    expect(listGrills.status).toBe(200)
    expect(await jsonOf<unknown[]>(listGrills)).toHaveLength(1)

    const questionRes = await handler(
      authed(token, `/v1/grills/${grill.id}/questions`, {
        prompt: 'Why is this concurrency-safe under retry?',
        severity: 'blocker',
      }),
    )
    expect(questionRes.status).toBe(201)
    const question = await jsonOf<{ id: string; verdict: string }>(questionRes)
    expect(question.verdict).toBe('pending')

    const answered = await handler(
      authed(token, `/v1/grill-questions/${question.id}/answer`, {
        answer: 'The CAS version column rejects stale writes.',
      }),
    )
    expect(answered.status).toBe(200)

    const decided = await handler(
      authed(token, `/v1/grill-questions/${question.id}/verdict`, {
        verdict: 'accepted',
      }),
    )
    expect(decided.status).toBe(200)
    expect((await jsonOf<{ verdict: string }>(decided)).verdict).toBe(
      'accepted',
    )

    const detail = await handler(
      authed(token, `/v1/grills/${grill.id}`, undefined, 'GET'),
    )
    expect(detail.status).toBe(200)
    const detailBody = await jsonOf<{
      grill: { id: string }
      questions: unknown[]
    }>(detail)
    expect(detailBody.grill.id).toBe(grill.id)
    expect(detailBody.questions).toHaveLength(1)

    const evaluated = await handler(
      authed(token, `/v1/grills/${grill.id}/evaluate`),
    )
    expect(evaluated.status).toBe(200)
    const evaluation = await jsonOf<{
      outcome: string
      grill: { state: string }
      blocking: string[]
    }>(evaluated)
    expect(evaluation.outcome).toBe('pass')
    expect(evaluation.grill.state).toBe('passed')
    expect(evaluation.blocking).toHaveLength(0)
  })
})
