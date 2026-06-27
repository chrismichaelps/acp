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
`Authorization: Bearer <session_id>` token (spec §8); `resolveActor` turns the
token back into the acting `WorkerId` so the transport can attribute mutations to
a real worker instead of the fallback `worker_system` actor. Persists through
[[Storage]] with schema-encode on write and schema-decode on read.

## Interface

### Signatures

```typescript
export interface SessionServiceApi {
  readonly create: (session: Session) => Effect<Session, StorageError>
  readonly get: (
    sessionId: SessionId,
  ) => Effect<Option<Session>, StorageError>
  readonly resolveActor: (
    token: string,
  ) => Effect<Option<WorkerId>, StorageError>
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
- No expiry in v0.1: sessions live for the process lifetime. A TTL sweeper is a
  post-v0.1 concern (see Grill Log).

### Linkage

- **Requires:** [[storage]], [[session.schema]], [[protocol-error]]
- **Consumed by:** [[acp-router]] (`initializeSession`, actor resolution).

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

- **Q:** Should the bearer token be a distinct secret (`hdf_xxx` per spec §8)
  rather than the `session_id` itself?
  **A:** No — in v0.1 the `session_id` *is* the token. *Rationale:* the local
  reference host has no credential store; minting a separate opaque secret adds a
  second identifier with no extra security at the trust boundary (a single local
  process). *Rejected:* a separate `token` column (premature — real secret
  management, rotation, and hashing belong to a hardened auth slice, not the
  reference implementation).
- **Q:** Should sessions expire?
  **A:** Not in this slice. *Rationale:* there is no clock-driven sweeper yet and
  no reconnect semantics in v0.1; an unbounded in-memory map is acceptable for a
  single-process reference host. *Rejected:* eager TTL (needs a background fiber
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
