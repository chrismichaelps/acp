/** @Acp.App.Cli.SessionAuthFlow.Test — CLI bootstrap plus bearer forwarding */
import { HttpApp, HttpClient, HttpClientResponse } from '@effect/platform'
import { Duration, Effect, Either, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppConfigTag } from '../../config/app-config.js'
import { AppLive } from '../index.js'
import { acpRouter, IdClockLive } from '../server/index.js'
import { runCliRequest } from './client.js'
import { parseArgs } from './commands.js'
import type { CliRequest } from './commands.js'
import type { HttpBody } from '@effect/platform/HttpBody'

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

const right = (argv: readonly string[]): CliRequest => {
  const parsed = parseArgs(argv)
  if (Either.isLeft(parsed)) {
    throw new Error(`expected Right, got: ${parsed.left.message}`)
  }
  return parsed.right
}

const bodyText = (body: HttpBody): string | undefined => {
  switch (body._tag) {
    case 'Empty':
      return undefined
    case 'Uint8Array':
      return new TextDecoder().decode(body.body)
    default:
      throw new Error(`unsupported test body: ${body._tag}`)
  }
}

const makeClient = () => {
  const handler = HttpApp.toWebHandlerLayer(
    acpRouter,
    Layer.mergeAll(AppLive, IdClockLive, requireAuthConfig),
  ).handler
  return HttpClient.make((request) =>
    Effect.promise(async () => {
      const response = await handler(
        new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: bodyText(request.body),
        }),
      )
      return HttpClientResponse.fromWeb(request, response)
    }),
  )
}

describe('CLI authenticated session flow', () => {
  it('initializes a session and uses its bearer token for a scoped command', async () => {
    const client = makeClient()
    const layer = Layer.succeed(HttpClient.HttpClient, client)

    const init = await Effect.runPromise(
      runCliRequest(
        right([
          'session',
          'init',
          '--worker',
          'agent_codex',
          '--name',
          'Codex',
          '--capabilities',
          'can_edit_files',
          '--permissions',
          'work:create',
        ]),
        'http://acp.test',
      ).pipe(Effect.provide(layer)),
    )

    expect(init.status).toBe(200)
    const token = (JSON.parse(init.body) as { session_id: string }).session_id

    const created = await Effect.runPromise(
      runCliRequest(
        right([
          'work',
          'create',
          'Authenticated CLI work',
          '--workspace',
          'workspace_1',
        ]),
        'http://acp.test',
        token,
      ).pipe(Effect.provide(layer)),
    )

    expect(created.status).toBe(201)
    expect(
      (JSON.parse(created.body) as { created_by: string }).created_by,
    ).toBe('agent_codex')
  })
})
