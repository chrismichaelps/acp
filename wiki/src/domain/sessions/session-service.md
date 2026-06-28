---
type: module
path: '@root/src/domain/sessions/session-service.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [session-service, SessionService]
---

# Session Service

## Purpose

Own the v0.1 session registry: a session is minted at
`POST /v1/session/initialize` (spec §9) and binds an opaque `SessionId` to the
[[Worker]] that opened it. Subsequent authenticated requests carry that id as a
`Authorization: Bearer <session_id>` token (spec §8). The session also stores the
`permissions` (spec §8 scopes) granted at initialize; `resolveActor` turns a token
back into the acting `WorkerId`, while [[acp-router]]`.authorize` reads the stored
session (via `get`) to both attribute the mutation and enforce its required scope.
Persists through [[Storage]] with schema-encode on write and schema-decode on read.

## Interface

### Signatures

```typescript
export interface SessionServiceApi {
  readonly create: (session: Session) => Effect<Session, StorageError>
  readonly get: (sessionId: SessionId) => Effect<Option<Session>, StorageError>
  readonly resolveActor: (
    token: string,
  ) => Effect<Option<WorkerId>, StorageError>
  readonly list: () => Effect<readonly Session[], StorageError>
  readonly evictExpired: (
    now: Timestamp,
    ttl: Duration,
  ) => Effect<readonly Session[], StorageError>
}

export class SessionService extends Context.Tag('SessionService')<
  SessionService,
  SessionServiceApi
>() {}
export const SessionServiceLive: Layer.Layer<SessionService, never, Storage>
```

### Governance

- The caller owns identity: `create` stores the `Session` value (id minted by
  [[id-clock]], `created_at` from the same clock); this service mints nothing.
- Session records are schema-encoded before storage and schema-decoded after
  reads for drift protection.
- `resolveActor` is total — an unknown or malformed token yields `Option.none`,
  never an error; the transport decides the fallback ([[acp-router]] uses
  `worker_system`).
- `list` decodes every stored session; `evictExpired` removes those whose
  `created_at + ttl ≤ now` and returns them. Eviction is attribute-only (no
  `session.*` event — sessions are host-local auth state, not coordination
  primitives). The TTL and cadence are owned by the [[sweeper]], not this service.

### Linkage

- **Requires:** [[storage]], [[session.schema]], [[protocol-error]]
- **Consumed by:** [[acp-router]] (`initializeSession`, actor resolution) and the
  [[sweeper]] (`list`, `evictExpired`).

## Algorithm

1. `create` encodes the `Session` through [[session.schema]] and `put`s it into
   the `session` collection under `session.id`, then returns the input session.
2. `get` loads the record; `Option.none` for absence, otherwise decodes through
   [[session.schema]].
3. `resolveActor` treats the bearer token as a `SessionId`, `get`s the session,
   and maps it to its `worker_id` — collapsing absence to `Option.none`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mint `SessionId`s here; [[id-clock]] supplies identity.
- ❌ Do NOT throw on an unknown token — `resolveActor` returns `Option.none`.
- ❌ Do NOT write raw undecoded objects into the `session` collection.
- ❌ Do NOT enforce token-format auth policy (scopes, expiry) in this slice.

## Depth

MEDIUM (0.55). Hides storage collection naming, encode/decode drift protection,
and token→actor resolution behind three methods. A registry with a derived
lookup, not a state machine.

## Grill Log

- **Q:** Where do permission scopes live — derived from the [[Worker]]
  `capabilities` booleans, or a separate set?
  **A:** A separate `permissions: Permission[]` on the session, declared in the
  `initialize` payload. _Rationale:_ spec §8 scopes (`work:create`, …) are an
  _authorization_ vocabulary distinct from §9 `capabilities`, which advertise what
  a worker _can do_ mechanically (`can_edit_files`), not what it is _allowed_ to do.
  Conflating them would force a brittle capability→scope mapping the spec never
  defines. _Rejected:_ deriving scopes from capabilities (semantic mismatch);
  a global all-workers-all-scopes default (toothless enforcement).
- **Q:** Should an unauthenticated mutation (no bearer token) be rejected with
  `401`, per the handoff's "reject instead of `worker_system`"?
  **A:** No — only _authenticated_ requests are scope-enforced; a request with no
  token still degrades to `worker_system` (full access). _Rationale:_ the local
  reference host has no credential issuance, so hard-requiring auth would make the
  server unusable out of the box and break every unauthenticated example/test. The
  enforced contract is "if you present a session, your scopes are checked; an
  invalid token or a missing scope is `401`." _Rejected:_ mandatory auth on all
  mutations (deferred to a hardened deployment that issues real credentials) — a
  reversible tightening once credential issuance exists.
- **Q:** Should the bearer token be a distinct secret (`hdf_xxx` per spec §8)
  rather than the `session_id` itself?
  **A:** No — in v0.1 the `session_id` _is_ the token. _Rationale:_ the local
  reference host has no credential store; minting a separate opaque secret adds a
  second identifier with no extra security at the trust boundary (a single local
  process). _Rejected:_ a separate `token` column (premature — real secret
  management, rotation, and hashing belong to a hardened auth slice, not the
  reference implementation).
- **Q:** Should sessions expire?
  **A:** Not in this slice. _Rationale:_ there is no clock-driven sweeper yet and
  no reconnect semantics in v0.1; an unbounded in-memory map is acceptable for a
  single-process reference host. _Rejected:_ eager TTL (needs a background fiber
  and an eviction policy the spec does not define) — deferred to a post-v0.1
  lease-expiry/session-sweeper slice.
- **Q:** Why does `resolveActor` return `Option` instead of failing with an
  `unauthorized` error?
  **A:** So the transport owns the auth policy. v0.1 mutations degrade to the
  `worker_system` actor when unauthenticated rather than rejecting; pushing a
  hard `401` into the service would couple the registry to a policy that the
  router (and a future scope check) should decide.

## Variants

Rejected: folding session creation into [[worker-service]] as
`WorkerService.session(...)`. Kept separate — capability negotiation and session
identity are a transport-edge concern (spec §9) with their own persistence
collection, not Worker registry state.

## Referenced by

[[sessions/_MOC]] · [[acp-router]] · [[Worker]] · [[src/_MOC]]
