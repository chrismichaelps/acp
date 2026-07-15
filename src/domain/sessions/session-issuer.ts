/** @Acp.Domain.Sessions.Issuer — transport-neutral session issuance seam */
import { Context, Effect, Layer, Option } from 'effect'
import type {
  Session,
  SessionPermissions,
  Worker,
} from '../../protocol/schema/index.js'
import type {
  StorageError,
  UnauthorizedError,
} from '../../protocol/errors/protocol-error.js'

export interface SessionIssuanceRequest {
  readonly worker: Worker
  readonly permissions: SessionPermissions
  readonly workspace_ids: Session['workspace_ids']
}

export interface SessionIssuanceGrant extends SessionIssuanceRequest {
  readonly provenance: Session['issuance']
}

export interface SessionIssuerApi {
  readonly issue: (
    credential: string,
    request: SessionIssuanceRequest,
  ) => Effect.Effect<SessionIssuanceGrant, UnauthorizedError | StorageError>
  readonly validate: (
    session: Session,
  ) => Effect.Effect<Session, UnauthorizedError>
}

export class SessionIssuer extends Context.Tag('SessionIssuer')<
  SessionIssuer,
  SessionIssuerApi
>() {}

export const TrustedClientSessionIssuer: SessionIssuerApi = {
  issue: (_credential, request) =>
    Effect.succeed({ ...request, provenance: Option.none() }),
  validate: Effect.succeed,
}

export const TrustedClientSessionIssuerLive: Layer.Layer<SessionIssuer> =
  Layer.succeed(SessionIssuer, TrustedClientSessionIssuer)
