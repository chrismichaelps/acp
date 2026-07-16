/** @Acp.App.Server.MetricsRoutes.Test — token gate and scrape output */
import { HttpApp } from '@effect/platform'
import { Duration, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppConfigTag, type AppConfig } from '../../config/app-config.js'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const configWith = (metricsToken: Option.Option<string>): AppConfig => ({
  profile: 'local',
  port: 4317,
  logLevel: 'info',
  storageAdapter: 'memory',
  eventBroker: 'in-process',
  sqlitePath: 'acp.sqlite',
  databaseUrl: Option.none(),
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxArtifactSizeBytes: 16 * 1024 * 1024,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: false,
  requireWorkspaceBindings: false,
  sessionIssuer: 'trusted-client',
  sessionIssuancePolicy: Option.none(),
  metricsToken,
})

const makeHandler = (metricsToken: Option.Option<string>) =>
  HttpApp.toWebHandlerLayer(
    acpRouter,
    Layer.mergeAll(
      AppLive,
      IdClockLive,
      Layer.succeed(AppConfigTag, configWith(metricsToken)),
    ),
  ).handler

const get = (headers: Record<string, string> = {}) =>
  new Request('http://acp.test/metrics', { method: 'GET', headers })

describe('metrics route', () => {
  it('returns 404 when no scrape token is configured', async () => {
    const handler = makeHandler(Option.none())
    const res = await handler(get())
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'not_found',
    )
  })

  it('rejects a scrape with no bearer token as 401', async () => {
    const handler = makeHandler(Option.some('scrape-secret'))
    const res = await handler(get())
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe('Bearer')
  })

  it('rejects a scrape with the wrong bearer token as 401', async () => {
    const handler = makeHandler(Option.some('scrape-secret'))
    const res = await handler(get({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('serves Prometheus text for a correctly authenticated scrape', async () => {
    const handler = makeHandler(Option.some('scrape-secret'))
    const res = await handler(get({ authorization: 'Bearer scrape-secret' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(res.headers.get('content-type')).toContain('version=0.0.4')
    const body = await res.text()
    expect(body).toContain('# TYPE acp_build_info gauge')
    expect(body).toMatch(/acp_build_info\{protocol_version="[^"]+"\} 1/)
  })

  it('records served HTTP requests into the scrape output', async () => {
    const handler = makeHandler(Option.some('scrape-secret'))
    // Serve a request through the boundary, then scrape and confirm the
    // completion was recorded — this exercises the respond() wiring, not just
    // the route itself.
    await handler(new Request('http://acp.test/health', { method: 'GET' }))
    const res = await handler(get({ authorization: 'Bearer scrape-secret' }))
    const body = await res.text()
    expect(body).toContain('# TYPE acp_http_requests_total counter')
    expect(body).toMatch(
      /acp_http_requests_total\{method="GET",route="\/health",status="200"\}/,
    )
  })
})
