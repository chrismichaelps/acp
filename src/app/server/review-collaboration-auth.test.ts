/** @Acp.App.Server.ReviewCollaborationAuth.Test — scope-first opaque target policy */
import { HttpApp } from '@effect/platform'
import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

const request = (
  token: string,
  path: string,
  body?: unknown,
  method = 'POST',
) =>
  new Request(`http://acp.test${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const initSession = async (
  handler: (req: Request) => Promise<Response>,
  workerId: string,
  permissions: readonly string[],
  workspaceIds?: readonly string[],
) => {
  const response = await handler(
    new Request('http://acp.test/v1/session/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        worker: {
          id: workerId,
          name: workerId,
          kind: 'agent',
          status: 'online',
          capabilities: ['can_review'],
        },
        permissions,
        ...(workspaceIds === undefined ? {} : { workspace_ids: workspaceIds }),
      }),
    }),
  )
  return ((await response.json()) as { session_id: string }).session_id
}

const setupTargets = async (
  handler: (req: Request) => Promise<Response>,
  token: string,
) => {
  const workspaceId = 'workspace_review_auth'
  const work = (await (
    await handler(
      request(token, '/v1/work', {
        workspace_id: workspaceId,
        title: 'Opaque collaboration targets',
      }),
    )
  ).json()) as { id: string }
  await handler(
    request(token, `/v1/work/${work.id}/claim`, {
      worker_id: 'agent_collaborator',
    }),
  )
  await handler(
    request(token, `/v1/work/${work.id}`, { state: 'running' }, 'PATCH'),
  )
  const review = (await (
    await handler(
      request(token, '/v1/reviews', {
        work_id: work.id,
        requested_by: 'agent_collaborator',
        requirements: ['non-enumeration'],
      }),
    )
  ).json()) as { id: string }
  const commentPayload = {
    review_id: review.id,
    work_id: work.id,
    workspace_id: workspaceId,
    target: {
      artifact_id: 'artifact_review_auth',
      file: 'src/auth.ts',
      side: 'new',
    },
    body: 'Opaque target.',
  }
  const comment = (await (
    await handler(
      request(token, `/v1/reviews/${review.id}/comments`, commentPayload),
    )
  ).json()) as { id: string }
  const grill = (await (
    await handler(
      request(token, `/v1/reviews/${review.id}/grill`, {
        review_id: review.id,
        work_id: work.id,
        workspace_id: workspaceId,
      }),
    )
  ).json()) as { id: string }
  const question = (await (
    await handler(
      request(token, `/v1/grills/${grill.id}/questions`, {
        prompt: 'Does the target leak?',
        severity: 'blocker',
      }),
    )
  ).json()) as { id: string }
  return { comment, commentPayload, grill, question, review }
}

const expectNotFound = async (
  response: Response,
  entity: string,
  id: string,
) => {
  expect(response.status).toBe(404)
  const body = (await response.json()) as {
    error: {
      code: string
      details: { value: { entity: string; id: string } }
    }
  }
  expect(body.error.code).toBe('not_found')
  expect(body.error.details.value).toEqual({ entity, id })
}

describe('review collaboration authorization', () => {
  it('echoes one REST role and rejects a dual-role session', async () => {
    const handler = makeHandler()
    const initialize = (permissions: readonly string[]) =>
      handler(
        new Request('http://acp.test/v1/session/initialize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            worker: {
              id: 'agent_session_role',
              name: 'Session role',
              kind: 'agent',
            },
            permissions,
          }),
        }),
      )

    for (const permission of ['review:collaborate', 'review:respond']) {
      const accepted = await initialize([permission])
      expect(accepted.status).toBe(200)
      expect(
        ((await accepted.json()) as { permissions: readonly string[] })
          .permissions,
      ).toEqual([permission])
    }
    const denied = await initialize(['review:respond', 'review:collaborate'])
    expect(denied.status).toBe(400)
    const deniedBody = (await denied.json()) as unknown
    expect(deniedBody).not.toHaveProperty('session_id')
    expect(JSON.stringify(deniedBody)).toContain(
      'review:respond and review:collaborate are mutually exclusive',
    )
  })

  it('checks action scope before resolving any opaque target', async () => {
    const handler = makeHandler()
    const legacy = await initSession(handler, 'agent_legacy', [
      'workspace:write',
    ])

    const responses = await Promise.all([
      handler(
        request(legacy, '/v1/reviews/review_missing/comments', {
          review_id: 'review_missing',
          work_id: 'work_missing',
          workspace_id: 'workspace_missing',
          target: {
            artifact_id: 'artifact_missing',
            file: 'src/missing.ts',
            side: 'new',
          },
          body: 'Denied before lookup.',
        }),
      ),
      handler(request(legacy, '/v1/review-comments/comment_missing/resolve')),
      handler(
        request(legacy, '/v1/reviews/review_missing/grill', {
          review_id: 'review_missing',
          work_id: 'work_missing',
          workspace_id: 'workspace_missing',
        }),
      ),
      handler(
        request(legacy, '/v1/grills/grill_missing/questions', {
          prompt: 'Denied before lookup?',
          severity: 'major',
        }),
      ),
      handler(
        request(legacy, '/v1/grill-questions/question_missing/answer', {
          answer: 'Denied before lookup.',
        }),
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      403, 403, 403, 403, 403,
    ])
  })

  it('uses the same not-found contract for missing and foreign target families', async () => {
    const handler = makeHandler()
    const collaborator = await initSession(handler, 'agent_collaborator', [
      'work:create',
      'work:claim',
      'work:update',
      'review:create',
      'review:collaborate',
    ])
    const targets = await setupTargets(handler, collaborator)
    const foreign = await initSession(
      handler,
      'agent_foreign_reviewer',
      ['review:collaborate'],
      ['workspace_other'],
    )

    const cases = [
      {
        entity: 'review',
        existingId: targets.review.id,
        missingId: 'review_missing',
        call: (id: string) =>
          handler(
            request(foreign, `/v1/reviews/${id}/grill`, {
              ...targets.commentPayload,
              review_id: id,
            }),
          ),
      },
      {
        entity: 'review_comment',
        existingId: targets.comment.id,
        missingId: 'comment_missing',
        call: (id: string) =>
          handler(request(foreign, `/v1/review-comments/${id}/resolve`)),
      },
      {
        entity: 'grill',
        existingId: targets.grill.id,
        missingId: 'grill_missing',
        call: (id: string) =>
          handler(
            request(foreign, `/v1/grills/${id}/questions`, {
              prompt: 'Opaque?',
              severity: 'minor',
            }),
          ),
      },
      {
        entity: 'grill_question',
        existingId: targets.question.id,
        missingId: 'question_missing',
        call: (id: string) =>
          handler(
            request(foreign, `/v1/grill-questions/${id}/verdict`, {
              verdict: 'accepted',
            }),
          ),
      },
    ]

    for (const target of cases) {
      await expectNotFound(
        await target.call(target.existingId),
        target.entity,
        target.existingId,
      )
      await expectNotFound(
        await target.call(target.missingId),
        target.entity,
        target.missingId,
      )
    }
  })

  it('denies a respond-only session on all eight collaboration mutations', async () => {
    const handler = makeHandler()
    const collaborator = await initSession(handler, 'agent_collaborator', [
      'work:create',
      'work:claim',
      'work:update',
      'review:create',
      'review:collaborate',
    ])
    const respondent = await initSession(handler, 'agent_respondent', [
      'review:respond',
    ])
    const targets = await setupTargets(handler, collaborator)
    const openPayload = {
      review_id: targets.review.id,
      work_id: targets.commentPayload.work_id,
      workspace_id: targets.commentPayload.workspace_id,
    }
    const responses = await Promise.all([
      handler(
        request(
          respondent,
          `/v1/reviews/${targets.review.id}/comments`,
          targets.commentPayload,
        ),
      ),
      handler(
        request(
          respondent,
          `/v1/review-comments/${targets.comment.id}/resolve`,
        ),
      ),
      handler(
        request(respondent, `/v1/review-comments/${targets.comment.id}/reopen`),
      ),
      handler(
        request(
          respondent,
          `/v1/review-comments/${targets.comment.id}/external-id`,
          { external_id: 'respondent-denied' },
        ),
      ),
      handler(
        request(
          respondent,
          `/v1/reviews/${targets.review.id}/grill`,
          openPayload,
        ),
      ),
      handler(
        request(respondent, `/v1/grills/${targets.grill.id}/questions`, {
          prompt: 'Respondent must not ask.',
          severity: 'minor',
        }),
      ),
      handler(
        request(
          respondent,
          `/v1/grill-questions/${targets.question.id}/verdict`,
          { verdict: 'accepted' },
        ),
      ),
      handler(request(respondent, `/v1/grills/${targets.grill.id}/evaluate`)),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      403, 403, 403, 403, 403, 403, 403, 403,
    ])
  })

  it('keeps both review roles outside workspace administration', async () => {
    const handler = makeHandler()
    const admin = await initSession(handler, 'agent_admin', ['workspace:write'])
    const collaborator = await initSession(handler, 'agent_collaborator', [
      'review:collaborate',
    ])
    const respondent = await initSession(handler, 'agent_respondent', [
      'review:respond',
    ])
    const workspace = (await (
      await handler(
        request(admin, '/v1/workspaces', {
          name: 'Review role admin target',
          kind: 'container',
          uri: 'docker://review-role-admin-target',
        }),
      )
    ).json()) as { id: string }
    const deniedFor = (token: string) => [
      handler(
        request(token, '/v1/workspaces', {
          name: 'Denied create',
          kind: 'container',
          uri: 'docker://denied-create',
        }),
      ),
      handler(
        request(
          token,
          `/v1/workspaces/${workspace.id}`,
          {
            name: 'Denied update',
            kind: 'container',
            uri: 'docker://denied-update',
          },
          'PATCH',
        ),
      ),
      handler(request(token, `/v1/workspaces/${workspace.id}/archive`)),
    ]

    const responses = await Promise.all([
      ...deniedFor(collaborator),
      ...deniedFor(respondent),
    ])
    expect(responses.map((response) => response.status)).toEqual([
      403, 403, 403, 403, 403, 403,
    ])
  })
})
