/** @Acp.App.Server.Router.Test — HTTP routes over a web handler */
import { describe, expect, it } from 'vitest'
import { HttpApp } from '@effect/platform'
import { Duration, Layer } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const makeHandler = () =>
  HttpApp.toWebHandlerLayer(acpRouter, Layer.mergeAll(AppLive, IdClockLive))
    .handler

const post = (path: string, body?: unknown) =>
  new Request(`http://acp.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const worker = {
  id: 'agent_claude_code',
  name: 'Claude Code',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files', 'can_review'],
}

describe('acpRouter', () => {
  it('initializes a session, returning a session id and host capabilities', async () => {
    const handler = makeHandler()
    const res = await handler(post('/v1/session/initialize', { worker }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      session_id: string
      protocol_version: string
      host: { name: string; kind: string }
      capabilities: { supports_sse: boolean }
    }
    expect(body.session_id).toMatch(/^session_/)
    expect(body.protocol_version).toBe('0.1')
    expect(body.host.kind).toBe('local')
    expect(body.capabilities.supports_sse).toBe(true)
  })

  it('accepts the spec capability-negotiation payload shape', async () => {
    const handler = makeHandler()
    const res = await handler(
      post('/v1/session/initialize', {
        protocol_version: '0.1',
        worker: {
          id: 'agent_openhands',
          name: 'OpenHands',
          kind: 'agent',
          vendor: 'openhands',
        },
        capabilities: {
          can_edit_files: true,
          can_run_commands: true,
          can_create_prs: false,
          can_review: true,
          supports_checkpoints: true,
          supports_leases: true,
        },
        permissions: ['work:create'],
      }),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      session_id: string
      protocol_version: string
      capabilities: { supports_reviews: boolean }
    }
    expect(body.session_id).toMatch(/^session_/)
    expect(body.protocol_version).toBe('0.1')
    expect(body.capabilities.supports_reviews).toBe(true)
  })

  it('rejects an unsupported protocol version during session initialization', async () => {
    const handler = makeHandler()
    const res = await handler(
      post('/v1/session/initialize', {
        protocol_version: '0.2',
        worker: {
          id: 'agent_future',
          name: 'Future Agent',
          kind: 'agent',
        },
      }),
    )

    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'invalid_request',
    )
  })

  const initSession = async (
    handler: (req: Request) => Promise<Response>,
    permissions: readonly string[],
  ) => {
    const res = await handler(
      post('/v1/session/initialize', { worker, permissions }),
    )
    return ((await res.json()) as { session_id: string }).session_id
  }

  const authedWork = (token: string) =>
    new Request('http://acp.test/v1/work', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workspace_id: 'workspace_1', title: 'Fix bug' }),
    })

  it('attributes a created work unit to the scoped session worker', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['work:create'])
    const res = await handler(authedWork(token))
    expect(res.status).toBe(201)
    expect(((await res.json()) as { created_by: string }).created_by).toBe(
      'agent_claude_code',
    )
  })

  it('rejects a mutation when the session lacks the required scope (401)', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['review:create'])
    const res = await handler(authedWork(token))
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'unauthorized',
    )
  })

  it('rejects an unknown bearer token (401)', async () => {
    const handler = makeHandler()
    const res = await handler(authedWork('session_does_not_exist'))
    expect(res.status).toBe(401)
  })

  it('falls back to the system actor when no bearer token is sent', async () => {
    const handler = makeHandler()
    const res = await handler(
      post('/v1/work', { workspace_id: 'workspace_1', title: 'Fix bug' }),
    )
    expect(res.status).toBe(201)
    expect(((await res.json()) as { created_by: string }).created_by).toBe(
      'worker_system',
    )
  })

  it('lists workspaces (empty by default)', async () => {
    const handler = makeHandler()
    const res = await handler(
      new Request('http://acp.test/v1/workspaces', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates and updates a workspace through scoped transport routes', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'workspace:read',
      'workspace:write',
    ])
    const created = await handler(
      new Request('http://acp.test/v1/workspaces', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'acme/web',
          kind: 'git_repository',
          uri: 'git+https://github.com/acme/web.git',
          default_branch: 'main',
          metadata: { provider: 'github' },
        }),
      }),
    )
    expect(created.status).toBe(201)
    const workspace = (await created.json()) as { id: string; name: string }
    expect(workspace.id).toMatch(/^workspace_/)
    expect(workspace.name).toBe('acme/web')

    const updated = await handler(
      new Request(`http://acp.test/v1/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'acme/web-renamed',
          kind: 'git_repository',
          uri: 'git+https://github.com/acme/web.git',
          metadata: { provider: 'github' },
        }),
      }),
    )
    expect(updated.status).toBe(200)
    expect(((await updated.json()) as { name: string }).name).toBe(
      'acme/web-renamed',
    )
  })

  it('creates a work unit as open (201)', async () => {
    const handler = makeHandler()
    const res = await handler(
      post('/v1/work', { workspace_id: 'workspace_1', title: 'Fix bug' }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { state: string; id: string }
    expect(body.state).toBe('open')
    expect(body.id).toMatch(/^work_/)
  })

  it('deletes an artifact and returns 404 on a repeated delete', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, ['artifact:create'])
    const created = await handler(
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
      }),
    )
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

  it('claims open work, rejecting a missing work unit with 404', async () => {
    const handler = makeHandler()
    const created = await handler(
      post('/v1/work', { workspace_id: 'workspace_1', title: 'Fix bug' }),
    )
    const { id } = (await created.json()) as { id: string }

    const claimed = await handler(
      post(`/v1/work/${id}/claim`, { worker_id: 'agent_claude_code' }),
    )
    expect(claimed.status).toBe(200)
    expect(((await claimed.json()) as { state: string }).state).toBe('claimed')

    const missing = await handler(
      post('/v1/work/work_missing/claim', { worker_id: 'agent_claude_code' }),
    )
    expect(missing.status).toBe(404)
  })

  it('requests a lease (201) and 404s releasing a missing one', async () => {
    const handler = makeHandler()
    const lease = await handler(
      post('/v1/leases', {
        workspace_id: 'workspace_1',
        holder: 'agent_claude_code',
        resource: { kind: 'file', uri: 'file://src/auth.ts' },
      }),
    )
    expect(lease.status).toBe(201)
    expect(((await lease.json()) as { state: string }).state).toBe('active')

    const release = await handler(post('/v1/leases/lease_missing/release'))
    expect(release.status).toBe(404)
  })

  it('approves, rejects, and requests changes for reviews', async () => {
    const handler = makeHandler()
    const token = await initSession(handler, [
      'work:create',
      'work:claim',
      'review:create',
    ])
    const created = await handler(authedWork(token))
    const workId = ((await created.json()) as { id: string }).id

    await handler(
      new Request(`http://acp.test/v1/work/${workId}/claim`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ worker_id: 'agent_claude_code' }),
      }),
    )
    await handler(
      new Request(`http://acp.test/v1/work/${workId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ state: 'running' }),
      }),
    )

    const requested = await handler(
      new Request('http://acp.test/v1/reviews', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          work_id: workId,
          requested_by: 'agent_claude_code',
          requirements: ['tests_pass'],
        }),
      }),
    )
    expect(requested.status).toBe(201)
    const reviewId = ((await requested.json()) as { id: string }).id

    const approved = await handler(
      new Request(`http://acp.test/v1/reviews/${reviewId}/approve`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ met_requirements: ['tests_pass'] }),
      }),
    )
    expect(approved.status).toBe(200)
    expect(((await approved.json()) as { state: string }).state).toBe(
      'approved',
    )

    const rejected = await handler(post('/v1/reviews/review_missing/reject'))
    expect(rejected.status).toBe(404)

    const changes = await handler(
      post('/v1/reviews/review_missing/request_changes'),
    )
    expect(changes.status).toBe(404)
  })
})

// requireAuth overrides AppLive's config (rightmost merge wins) so authorize sees it.
const requireAuthConfig = Layer.succeed(AppConfigTag, {
  port: 4317,
  logLevel: 'info' as const,
  storageAdapter: 'memory' as const,
  sqlitePath: 'acp.sqlite',
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: true,
})

describe('acpRouter with ACP_REQUIRE_AUTH', () => {
  const makeAuthHandler = () =>
    HttpApp.toWebHandlerLayer(
      acpRouter,
      Layer.mergeAll(AppLive, IdClockLive, requireAuthConfig),
    ).handler

  it('rejects an unauthenticated mutation with 401', async () => {
    const handler = makeAuthHandler()
    const res = await handler(
      post('/v1/work', { workspace_id: 'workspace_1', title: 'Fix bug' }),
    )
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'unauthorized',
    )
  })

  it('still allows session/initialize (the open bootstrap route) and authed work', async () => {
    const handler = makeAuthHandler()
    const init = await handler(
      post('/v1/session/initialize', { worker, permissions: ['work:create'] }),
    )
    expect(init.status).toBe(200)
    const token = ((await init.json()) as { session_id: string }).session_id

    const res = await handler(
      new Request('http://acp.test/v1/work', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workspace_id: 'workspace_1', title: 'Fix bug' }),
      }),
    )
    expect(res.status).toBe(201)
    expect(((await res.json()) as { created_by: string }).created_by).toBe(
      'agent_claude_code',
    )
  })
})
