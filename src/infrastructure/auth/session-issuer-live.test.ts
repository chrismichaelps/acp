/** @Acp.Infra.Auth.SessionIssuerLive.Test — hostile policy and revocation */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Cause, Duration, Effect, Exit, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionIssuer } from '../../domain/sessions/index.js'
import { InMemoryStorageLive, Storage } from '../storage/index.js'
import { Session, Worker } from '../../protocol/schema/index.js'
import { SessionIssuerLive } from './session-issuer-live.js'

const digest = (credential: string) =>
  createHash('sha256').update(credential).digest('hex')

const policy = (
  credential = 'issuance-secret',
  principalId = 'principal_ci',
  workerId = 'agent_policy',
  revision = '1',
  enabled = true,
  issuerId = 'issuer_test',
) => ({
  issuer_id: issuerId,
  principals: [
    {
      id: principalId,
      revision,
      enabled,
      credential_sha256: digest(credential),
      worker: {
        id: workerId,
        name: 'Policy agent',
        kind: 'ci',
        status: 'online',
        capabilities: ['can_run_commands', 'can_edit_files'],
      },
      permissions: ['work:create', 'workspace:read'],
      workspace_ids: ['workspace_policy'],
    },
  ],
})

const configLayer = (value: unknown) =>
  Layer.succeed(AppConfigTag, {
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
    sessionIssuancePolicy: Option.some(JSON.stringify(value)),
  })

const issuerLayer = (value: unknown, storage = InMemoryStorageLive) =>
  SessionIssuerLive.pipe(
    Layer.provide(Layer.merge(configLayer(value), storage)),
  )

const hostileRequest = {
  worker: Schema.decodeUnknownSync(Worker)({
    id: 'agent_hostile',
    name: 'Hostile caller',
    kind: 'agent',
    status: 'online',
    capabilities: ['can_create_prs'],
  }),
  permissions: ['review:approve'] as const,
  workspace_ids: Option.none(),
}

describe('SessionIssuerLive', () => {
  it('derives the complete grant and denies unknown credentials opaquely', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const issuer = yield* SessionIssuer
        const denied = yield* Effect.either(
          issuer.issue('wrong-secret', hostileRequest),
        )
        const grant = yield* issuer.issue('issuance-secret', hostileRequest)
        return { denied, grant }
      }).pipe(Effect.provide(issuerLayer(policy()))),
    )

    expect(result.denied._tag).toBe('Left')
    if (result.denied._tag === 'Left') {
      expect(result.denied.left._tag).toBe('UnauthorizedError')
      if (result.denied.left._tag === 'UnauthorizedError') {
        expect(result.denied.left.reason).toBe('invalid session credential')
      }
    }
    expect(result.grant.worker.id).toBe('agent_policy')
    expect(result.grant.worker.capabilities).toEqual([
      'can_edit_files',
      'can_run_commands',
    ])
    expect(result.grant.permissions).toEqual(['work:create', 'workspace:read'])
    expect(Option.getOrThrow(result.grant.workspace_ids)).toEqual([
      'workspace_policy',
    ])
    expect(Option.getOrThrow(result.grant.provenance)).toEqual({
      mode: 'static',
      issuer_id: 'issuer_test',
      principal_id: 'principal_ci',
      revision: '1',
    })
  })

  it('validates exact provenance and revokes a stale revision', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const issuer = yield* SessionIssuer
        const grant = yield* issuer.issue('issuance-secret', hostileRequest)
        const current = Schema.decodeUnknownSync(Session)({
          id: 'session_policy',
          worker_id: grant.worker.id,
          created_at: '2026-07-15T00:00:00.000Z',
          permissions: grant.permissions,
          workspace_ids: Option.getOrThrow(grant.workspace_ids),
          issuance: Option.getOrThrow(grant.provenance),
        })
        const valid = yield* issuer.validate(current)
        const stale = yield* Effect.either(
          issuer.validate({
            ...current,
            issuance: Option.some({
              ...Option.getOrThrow(current.issuance),
              revision: '0',
            }),
          }),
        )
        return { valid, stale }
      }).pipe(Effect.provide(issuerLayer(policy()))),
    )

    expect(result.valid.id).toBe('session_policy')
    expect(result.stale._tag).toBe('Left')
  })

  it('retains bidirectional principal attribution across issuer layers', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage
        const stored = Layer.succeed(Storage, storage)
        const first = issuerLayer(policy(), stored)
        yield* Effect.provide(
          Effect.flatMap(SessionIssuer, (issuer) =>
            issuer.issue('issuance-secret', hostileRequest),
          ),
          first,
        )
        const remapped = issuerLayer(
          policy('second-secret', 'principal_other', 'agent_policy'),
          stored,
        )
        return yield* Effect.either(
          Effect.provide(
            Effect.flatMap(SessionIssuer, (issuer) =>
              issuer.issue('second-secret', hostileRequest),
            ),
            remapped,
          ),
        )
      }).pipe(Effect.provide(InMemoryStorageLive)),
    )

    expect(result._tag).toBe('Left')
  })

  it('rejects worker remapping after the configured issuer changes', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage
        const stored = Layer.succeed(Storage, storage)
        yield* Effect.provide(
          Effect.flatMap(SessionIssuer, (issuer) =>
            issuer.issue('issuance-secret', hostileRequest),
          ),
          issuerLayer(policy(), stored),
        )
        return yield* Effect.either(
          Effect.provide(
            Effect.flatMap(SessionIssuer, (issuer) =>
              issuer.issue('third-secret', hostileRequest),
            ),
            issuerLayer(
              policy(
                'third-secret',
                'principal_other',
                'agent_policy',
                '1',
                true,
                'issuer_other',
              ),
              stored,
            ),
          ),
        )
      }).pipe(Effect.provide(InMemoryStorageLive)),
    )

    expect(result._tag).toBe('Left')
  })

  it('sanitizes malformed policy startup defects', async () => {
    const rawSecret = 'plaintext-must-not-leak'
    const malformed = policy()
    malformed.principals[0].credential_sha256 = rawSecret
    const exit = await Effect.runPromiseExit(
      Effect.provide(SessionIssuer, issuerLayer(malformed)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const rendered = Cause.pretty(exit.cause)
      expect(rendered).toContain('invalid session issuance policy')
      expect(rendered).not.toContain(rawSecret)
    }
  })
})
