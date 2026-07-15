/** @Acp.App.Server.SessionInitializer — shared session initialization transaction */
import { Effect, Option } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { SessionIssuer, SessionService } from '../../domain/sessions/index.js'
import { WorkerService } from '../../domain/workers/index.js'
import type {
  InitializeSessionPayload,
  InitializeSessionResponse,
} from '../../infrastructure/http/index.js'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import type {
  StorageError,
  UnauthorizedError,
} from '../../protocol/errors/protocol-error.js'
import {
  ACP_PROTOCOL_VERSION,
  isSupportedProtocolVersion,
} from '../../protocol/schema/index.js'
import type { Capability, SessionId } from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'

const host = { name: 'ACP Local', kind: 'local' } as const
const hostCapabilities = {
  supports_events: true,
  supports_reviews: true,
  supports_signed_review_approvals: true,
  supports_artifacts: true,
  supports_memory: true,
  supports_sse: true,
} as const

const capabilityFlags: readonly (readonly [
  keyof InitializeSessionPayload['capabilities'],
  Capability,
])[] = [
  ['can_edit_files', 'can_edit_files'],
  ['can_run_commands', 'can_run_commands'],
  ['can_create_prs', 'can_create_prs'],
  ['can_review', 'can_review'],
  ['supports_checkpoints', 'supports_checkpoints'],
  ['supports_leases', 'supports_leases'],
]

const capabilitiesFromHandshake = (
  payload: InitializeSessionPayload,
): readonly Capability[] => {
  if (payload.worker.capabilities.length > 0) {
    return payload.worker.capabilities
  }
  return capabilityFlags.flatMap(([flag, capability]) =>
    payload.capabilities[flag] ? [capability] : [],
  )
}

const hasWorkspaceBinding = (
  workspaceIds: InitializeSessionPayload['workspace_ids'],
) =>
  Option.match(workspaceIds, {
    onNone: () => false,
    onSome: (ids) => ids.length > 0,
  })

export const initializeSession = (
  payload: InitializeSessionPayload,
  credential: string,
): Effect.Effect<
  InitializeSessionResponse,
  ValidationError | UnauthorizedError | StorageError,
  AppConfigTag | IdClock | SessionIssuer | SessionService | WorkerService
> =>
  Effect.gen(function* () {
    if (!isSupportedProtocolVersion(payload.protocol_version)) {
      return yield* Effect.fail(
        new ValidationError({
          issues: [`unsupported protocol_version: ${payload.protocol_version}`],
        }),
      )
    }
    const config = yield* AppConfigTag
    if (
      config.sessionIssuer === 'trusted-client' &&
      config.requireWorkspaceBindings &&
      !hasWorkspaceBinding(payload.workspace_ids)
    ) {
      return yield* Effect.fail(
        new ValidationError({
          issues: [
            'workspace_ids must include at least one workspace when workspace-bound sessions are required',
          ],
        }),
      )
    }

    const issuer = yield* SessionIssuer
    const grant = yield* issuer.issue(credential, {
      worker: {
        ...payload.worker,
        capabilities: capabilitiesFromHandshake(payload),
      },
      permissions: payload.permissions,
      workspace_ids: payload.workspace_ids,
    })
    const workers = yield* WorkerService
    const worker = yield* workers.register(grant.worker)
    const idClock = yield* IdClock
    const sessionId = (yield* idClock.secureToken('session')) as SessionId
    const now = yield* idClock.now
    const sessions = yield* SessionService
    const session = yield* sessions.create({
      id: sessionId,
      worker_id: worker.id,
      created_at: now,
      permissions: grant.permissions,
      workspace_ids: grant.workspace_ids,
      issuance: grant.provenance,
    })

    return {
      session_id: session.id,
      permissions: session.permissions,
      protocol_version: ACP_PROTOCOL_VERSION,
      host,
      capabilities: hostCapabilities,
      workspace_ids: session.workspace_ids,
    }
  })
