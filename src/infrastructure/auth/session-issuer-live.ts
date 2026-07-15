/** @Acp.Infra.Auth.SessionIssuerLive — config-selected trusted/static issuer */
import { Headers } from '@effect/platform'
import { createHash, timingSafeEqual } from 'node:crypto'
import { Effect, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import {
  SessionIssuer,
  TrustedClientSessionIssuer,
} from '../../domain/sessions/index.js'
import type {
  SessionIssuanceGrant,
  SessionIssuerApi,
} from '../../domain/sessions/index.js'
import { Storage } from '../storage/index.js'
import type { StorageApi } from '../storage/index.js'
import {
  StorageError,
  UnauthorizedError,
} from '../../protocol/errors/protocol-error.js'
import {
  SessionPermissions,
  Worker,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type {
  Session,
  Worker as WorkerModel,
  WorkerId,
  WorkspaceId as WorkspaceIdModel,
} from '../../protocol/schema/index.js'

const StaticPrincipal = Schema.Struct({
  id: Schema.NonEmptyString,
  revision: Schema.NonEmptyString,
  enabled: Schema.Boolean,
  credential_sha256: Schema.String,
  worker: Worker,
  permissions: SessionPermissions,
  workspace_ids: Schema.Array(WorkspaceId),
})

const StaticPolicy = Schema.Struct({
  issuer_id: Schema.NonEmptyString,
  principals: Schema.Array(StaticPrincipal),
})

type StaticPolicy = typeof StaticPolicy.Type
type StaticPrincipal = typeof StaticPrincipal.Type

const PrincipalBinding = Schema.Struct({
  issuer_id: Schema.NonEmptyString,
  principal_id: Schema.NonEmptyString,
  worker_id: Worker.fields.id,
})
const WorkerBinding = Schema.Struct({
  worker_id: Worker.fields.id,
  issuer_id: Schema.NonEmptyString,
  principal_id: Schema.NonEmptyString,
})
const BindingRegistry = Schema.Struct({
  principals: Schema.Array(PrincipalBinding),
  workers: Schema.Array(WorkerBinding),
})
type BindingRegistry = typeof BindingRegistry.Type

const registryCollection = 'session_principal_binding'
const registryKey = 'global'
const maxCasAttempts = 32
const lowercaseSha256 = /^[0-9a-f]{64}$/

const unauthorized = () =>
  new UnauthorizedError({ reason: 'invalid session credential' })
const revoked = () => new UnauthorizedError({ reason: 'invalid session token' })

const hasDuplicates = (values: readonly string[]) =>
  new Set(values).size !== values.length

const sorted = <A extends string>(values: readonly A[]): readonly A[] =>
  [...values].sort((left, right) => left.localeCompare(right))

const normalizeWorker = (worker: WorkerModel): WorkerModel => ({
  ...worker,
  capabilities: sorted(worker.capabilities),
})

const normalizePrincipal = (principal: StaticPrincipal): StaticPrincipal => ({
  ...principal,
  worker: normalizeWorker(principal.worker),
  permissions: sorted(principal.permissions),
  workspace_ids: sorted(principal.workspace_ids),
})

const validPolicy = (policy: StaticPolicy): boolean => {
  if (policy.principals.length === 0) return false
  if (
    hasDuplicates(policy.principals.map((principal) => principal.id)) ||
    hasDuplicates(policy.principals.map((principal) => principal.worker.id)) ||
    hasDuplicates(
      policy.principals.map((principal) => principal.credential_sha256),
    )
  ) {
    return false
  }
  return policy.principals.every(
    (principal) =>
      lowercaseSha256.test(principal.credential_sha256) &&
      principal.workspace_ids.length > 0 &&
      !hasDuplicates(principal.worker.capabilities) &&
      !hasDuplicates(principal.permissions) &&
      !hasDuplicates(principal.workspace_ids),
  )
}

const decodePolicy = (raw: string) =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: () => new Error('invalid session issuance policy'),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(StaticPolicy)),
    Effect.filterOrFail(
      validPolicy,
      () => new Error('invalid session issuance policy'),
    ),
    Effect.map((policy) => ({
      ...policy,
      principals: policy.principals.map(normalizePrincipal),
    })),
    Effect.mapError(() => new Error('invalid session issuance policy')),
  )

export const bearerCredential = (headers: Headers.Headers): string =>
  Option.match(Headers.get(headers, 'authorization'), {
    onNone: () => '',
    onSome: (header) =>
      header.toLowerCase().startsWith('bearer ')
        ? header.slice('bearer '.length).trim()
        : '',
  })

const decodeRegistry = (value: unknown) =>
  Schema.decodeUnknown(BindingRegistry)(value).pipe(
    Effect.mapError(
      () =>
        new StorageError({
          op: 'decode_session_principal_binding',
          cause: 'invalid principal binding registry',
        }),
    ),
  )

const addBinding = (
  registry: BindingRegistry,
  issuerId: string,
  principalId: string,
  workerId: WorkerId,
): BindingRegistry => ({
  principals: [
    ...registry.principals,
    { issuer_id: issuerId, principal_id: principalId, worker_id: workerId },
  ].sort((left, right) =>
    `${left.issuer_id}\u0000${left.principal_id}`.localeCompare(
      `${right.issuer_id}\u0000${right.principal_id}`,
    ),
  ),
  workers: [
    ...registry.workers,
    { worker_id: workerId, issuer_id: issuerId, principal_id: principalId },
  ].sort((left, right) => left.worker_id.localeCompare(right.worker_id)),
})

const ensureBinding = (
  storage: StorageApi,
  issuerId: string,
  principalId: string,
  workerId: WorkerId,
  attempt = 0,
): Effect.Effect<void, StorageError | UnauthorizedError> =>
  Effect.suspend(() => {
    if (attempt >= maxCasAttempts) {
      return Effect.fail(
        new StorageError({
          op: 'bind_session_principal',
          cause: 'principal binding contention limit exceeded',
        }),
      )
    }
    return Effect.flatMap(
      storage.getVersioned(registryCollection, registryKey),
      (stored) =>
        Option.match(stored, {
          onNone: () =>
            Effect.flatMap(
              storage.putIfAbsent(registryCollection, registryKey, {
                principals: [
                  {
                    issuer_id: issuerId,
                    principal_id: principalId,
                    worker_id: workerId,
                  },
                ],
                workers: [
                  {
                    worker_id: workerId,
                    issuer_id: issuerId,
                    principal_id: principalId,
                  },
                ],
              } satisfies BindingRegistry),
              (created) =>
                created
                  ? Effect.void
                  : ensureBinding(
                      storage,
                      issuerId,
                      principalId,
                      workerId,
                      attempt + 1,
                    ),
            ),
          onSome: ({ value, version }) =>
            Effect.flatMap(decodeRegistry(value), (registry) => {
              const principal = registry.principals.find(
                (binding) =>
                  binding.issuer_id === issuerId &&
                  binding.principal_id === principalId,
              )
              const worker = registry.workers.find(
                (binding) => binding.worker_id === workerId,
              )
              if (
                (principal !== undefined && principal.worker_id !== workerId) ||
                (worker !== undefined &&
                  (worker.issuer_id !== issuerId ||
                    worker.principal_id !== principalId)) ||
                (principal === undefined) !== (worker === undefined)
              ) {
                return Effect.fail(unauthorized())
              }
              if (principal !== undefined && worker !== undefined) {
                return Effect.void
              }
              return Effect.flatMap(
                storage.replaceIfVersion(
                  registryCollection,
                  registryKey,
                  version,
                  addBinding(registry, issuerId, principalId, workerId),
                ),
                (replaced) =>
                  replaced
                    ? Effect.void
                    : ensureBinding(
                        storage,
                        issuerId,
                        principalId,
                        workerId,
                        attempt + 1,
                      ),
              )
            }),
        }),
    )
  })

const credentialDigest = (credential: string) =>
  createHash('sha256').update(credential).digest()

const matchesCredential = (presentedDigest: Buffer, configuredDigest: string) =>
  timingSafeEqual(presentedDigest, Buffer.from(configuredDigest, 'hex'))

const principalForCredential = (
  policy: StaticPolicy,
  presentedDigest: Buffer,
): StaticPrincipal | undefined =>
  policy.principals.reduce<StaticPrincipal | undefined>(
    (matched, candidate) =>
      matchesCredential(presentedDigest, candidate.credential_sha256)
        ? candidate
        : matched,
    undefined,
  )

const sameArray = <A extends string>(left: readonly A[], right: readonly A[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index])

const sameWorkspaces = (
  actual: Session['workspace_ids'],
  expected: readonly WorkspaceIdModel[],
) =>
  Option.match(actual, {
    onNone: () => false,
    onSome: (workspaceIds) => sameArray(workspaceIds, expected),
  })

const securityAudit = (
  policy: StaticPolicy,
  decision: 'accepted' | 'denied' | 'revoked',
  reason: string,
  principal?: StaticPrincipal,
) => {
  const annotations = {
    security_event: 'session_issuance',
    issuer_id: policy.issuer_id,
    decision,
    reason,
    ...(principal === undefined
      ? {}
      : {
          principal_id: principal.id,
          worker_id: principal.worker.id,
          permissions: principal.permissions.join(','),
          workspace_ids: principal.workspace_ids.join(','),
        }),
  }
  const log =
    decision === 'accepted'
      ? Effect.logInfo('session issuance decision')
      : Effect.logWarning('session issuance decision')
  return log.pipe(Effect.annotateLogs(annotations))
}

const staticIssuer = (
  policy: StaticPolicy,
  storage: StorageApi,
): SessionIssuerApi => ({
  issue: (credential) =>
    Effect.gen(function* () {
      const digest = credentialDigest(credential)
      const principal = principalForCredential(policy, digest)
      if (!principal?.enabled) {
        yield* securityAudit(
          policy,
          'denied',
          principal === undefined ? 'invalid_credential' : 'principal_disabled',
          principal,
        )
        return yield* Effect.fail(unauthorized())
      }
      const binding = yield* Effect.either(
        ensureBinding(
          storage,
          policy.issuer_id,
          principal.id,
          principal.worker.id,
        ),
      )
      if (binding._tag === 'Left') {
        yield* securityAudit(policy, 'denied', 'principal_binding', principal)
        return yield* Effect.fail(binding.left)
      }
      yield* securityAudit(policy, 'accepted', 'credential_verified', principal)
      return {
        worker: principal.worker,
        permissions: principal.permissions,
        workspace_ids: Option.some(principal.workspace_ids),
        provenance: Option.some({
          mode: 'static',
          issuer_id: policy.issuer_id,
          principal_id: principal.id,
          revision: principal.revision,
        }),
      } satisfies SessionIssuanceGrant
    }),
  validate: (session) =>
    Effect.gen(function* () {
      const provenance = session.issuance
      const principal = Option.isSome(provenance)
        ? policy.principals.find(
            (candidate) => candidate.id === provenance.value.principal_id,
          )
        : undefined
      const valid =
        Option.isSome(provenance) &&
        provenance.value.issuer_id === policy.issuer_id &&
        principal !== undefined &&
        principal.enabled &&
        provenance.value.revision === principal.revision &&
        session.worker_id === principal.worker.id &&
        sameArray(session.permissions, principal.permissions) &&
        sameWorkspaces(session.workspace_ids, principal.workspace_ids)
      if (!valid) {
        yield* securityAudit(policy, 'revoked', 'policy_mismatch', principal)
        return yield* Effect.fail(revoked())
      }
      return session
    }),
})

const make = Effect.gen(function* () {
  const config = yield* AppConfigTag
  if (config.sessionIssuer === 'trusted-client') {
    return TrustedClientSessionIssuer
  }
  const rawPolicy = Option.getOrElse(config.sessionIssuancePolicy, () => '')
  const policy = yield* decodePolicy(rawPolicy).pipe(Effect.orDie)
  const storage = yield* Storage
  return staticIssuer(policy, storage)
})

export const SessionIssuerLive: Layer.Layer<
  SessionIssuer,
  never,
  AppConfigTag | Storage
> = Layer.effect(SessionIssuer, make)
