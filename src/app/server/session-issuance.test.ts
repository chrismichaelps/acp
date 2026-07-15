/** @Acp.App.Server.SessionIssuance.Test — live hostile-client HTTP boundary */
import { createHash } from 'node:crypto'
import { HttpApp } from '@effect/platform'
import { describe, expect, it } from 'vitest'
import { Duration, Layer, Option } from 'effect'
import { AppLive } from '../app-live.js'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionIssuerLive } from '../../infrastructure/auth/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const credential = 'static-issuance-secret'
const issuancePolicy = JSON.stringify({
  issuer_id: 'issuer_http',
  principals: [
    {
      id: 'principal_http',
      revision: '1',
      enabled: true,
      credential_sha256: createHash('sha256').update(credential).digest('hex'),
      worker: {
        id: 'agent_policy_http',
        name: 'Policy HTTP agent',
        kind: 'ci',
        status: 'online',
        capabilities: ['can_run_commands'],
      },
      permissions: ['work:create', 'worker:read'],
      workspace_ids: ['workspace_policy'],
    },
  ],
})

const StaticConfigLive = Layer.succeed(AppConfigTag, {
  profile: 'local' as const,
  port: 4317,
  logLevel: 'info' as const,
  storageAdapter: 'memory' as const,
  eventBroker: 'in-process' as const,
  sqlitePath: 'acp.sqlite',
  databaseUrl: Option.none(),
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: true,
  requireWorkspaceBindings: true,
  sessionIssuer: 'static' as const,
  sessionIssuancePolicy: Option.some(issuancePolicy),
})

const StaticIssuerLive = SessionIssuerLive.pipe(
  Layer.provide(Layer.merge(StaticConfigLive, InMemoryStorageLive)),
)

const runtime = Layer.mergeAll(
  AppLive,
  IdClockLive,
  StaticConfigLive,
  StaticIssuerLive,
)

const handler = () => HttpApp.toWebHandlerLayer(acpRouter, runtime).handler

const initialize = (authorization?: string, includeWorkspaceBinding = true) =>
  new Request('http://acp.test/v1/session/initialize', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization === undefined ? {} : { authorization }),
    },
    body: JSON.stringify({
      worker: {
        id: 'agent_hostile_http',
        name: 'Hostile HTTP agent',
        kind: 'agent',
      },
      capabilities: { can_create_prs: true },
      permissions: ['review:approve'],
      ...(includeWorkspaceBinding
        ? { workspace_ids: ['workspace_hostile'] }
        : {}),
    }),
  })

describe('static session issuance over HTTP', () => {
  it('denies missing and wrong issuance credentials with one envelope', async () => {
    const app = handler()
    const missing = await app(initialize())
    const wrong = await app(initialize('Bearer wrong-secret'))
    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(await missing.json()).toEqual(await wrong.json())
  })

  it('replaces hostile identity, scopes, and bindings with the policy grant', async () => {
    const app = handler()
    const initialized = await app(initialize(`Bearer ${credential}`, false))
    expect(initialized.status).toBe(200)
    const session = (await initialized.json()) as {
      readonly session_id: string
      readonly permissions: readonly string[]
      readonly workspace_ids: readonly string[]
    }
    expect(session.permissions).toEqual(['work:create', 'worker:read'])
    expect(session.workspace_ids).toEqual(['workspace_policy'])

    const workers = await app(
      new Request('http://acp.test/v1/workers', {
        headers: { authorization: `Bearer ${session.session_id}` },
      }),
    )
    expect(workers.status).toBe(200)
    expect(await workers.json()).toEqual([
      expect.objectContaining({ id: 'agent_policy_http' }),
    ])

    const foreign = await app(
      new Request('http://acp.test/v1/work', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session.session_id}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: 'workspace_hostile',
          title: 'Denied hostile work',
        }),
      }),
    )
    expect(foreign.status).toBe(403)
  })
})
