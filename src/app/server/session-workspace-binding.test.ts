/** @Acp.App.Server.SessionWorkspaceBinding.Test — hosted session policy */
import { HttpApp } from '@effect/platform'
import { Duration, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppConfigTag } from '../../config/app-config.js'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const requireWorkspaceBindingsConfig = Layer.succeed(AppConfigTag, {
  port: 4317,
  logLevel: 'info' as const,
  storageAdapter: 'postgres' as const,
  eventBroker: 'pg-notify' as const,
  sqlitePath: 'acp.sqlite',
  databaseUrl: Option.some('postgres://acp.example/acp'),
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: true,
  requireWorkspaceBindings: true,
})

const handler = () =>
  HttpApp.toWebHandlerLayer(
    acpRouter,
    Layer.mergeAll(AppLive, IdClockLive, requireWorkspaceBindingsConfig),
  ).handler

const post = (body: unknown) =>
  new Request('http://acp.test/v1/session/initialize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const worker = {
  id: 'agent_hosted_policy',
  name: 'Hosted Policy Agent',
  kind: 'agent',
}

describe('session workspace binding policy', () => {
  it('requires workspace bindings during HTTP session initialization when configured', async () => {
    const route = handler()
    const missing = await route(
      post({
        worker,
        permissions: ['work:create'],
      }),
    )
    const empty = await route(
      post({
        worker,
        permissions: ['work:create'],
        workspace_ids: [],
      }),
    )
    const bound = await route(
      post({
        worker,
        permissions: ['work:create'],
        workspace_ids: ['workspace_bound'],
      }),
    )

    expect(missing.status).toBe(400)
    expect(empty.status).toBe(400)
    expect(bound.status).toBe(200)
    expect(
      ((await bound.json()) as { workspace_ids: readonly string[] })
        .workspace_ids,
    ).toEqual(['workspace_bound'])
  })
})
