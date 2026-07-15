/** @Acp.Domain.Sessions.Issuer.Test — trusted-client compatibility */
import { describe, expect, it } from 'vitest'
import { Effect, Option, Schema } from 'effect'
import { Session, Worker } from '../../protocol/schema/index.js'
import {
  SessionIssuer,
  TrustedClientSessionIssuerLive,
} from './session-issuer.js'

const worker = Schema.decodeUnknownSync(Worker)({
  id: 'agent_local',
  name: 'Local agent',
  kind: 'agent',
  status: 'online',
  capabilities: ['can_edit_files'],
})

describe('TrustedClientSessionIssuerLive', () => {
  it('preserves the normalized request and records no provenance', async () => {
    const grant = await Effect.runPromise(
      Effect.gen(function* () {
        const issuer = yield* SessionIssuer
        return yield* issuer.issue('', {
          worker,
          permissions: ['work:create'],
          workspace_ids: Option.none(),
        })
      }).pipe(Effect.provide(TrustedClientSessionIssuerLive)),
    )

    expect(grant.worker).toEqual(worker)
    expect(grant.permissions).toEqual(['work:create'])
    expect(Option.isNone(grant.workspace_ids)).toBe(true)
    expect(Option.isNone(grant.provenance)).toBe(true)
  })

  it('validates an existing compatibility session unchanged', async () => {
    const session = Schema.decodeUnknownSync(Session)({
      id: 'session_local',
      worker_id: 'agent_local',
      created_at: '2026-07-15T00:00:00.000Z',
      permissions: ['work:create'],
    })
    const validated = await Effect.runPromise(
      Effect.gen(function* () {
        const issuer = yield* SessionIssuer
        return yield* issuer.validate(session)
      }).pipe(Effect.provide(TrustedClientSessionIssuerLive)),
    )
    expect(validated).toEqual(session)
  })
})
