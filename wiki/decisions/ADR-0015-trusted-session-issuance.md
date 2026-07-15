---
type: decision
status: ACCEPTED
date: 2026-07-15
tags: [adr, accepted, auth, identity, hosting, security]
aliases: [ADR-0015, trusted-session-issuance]
---

# ADR-0015 — Trusted Session Issuance for Hosted ACP

## Context

ACP v0.1 leaves `session.initialize` open because it mints the first bearer
session. Its body is caller-controlled: the client selects worker identity,
permissions, capabilities, and workspace bindings. Requiring a session on later
routes proves possession of a minted token but not that a trusted authority
approved the caller or its grant. That is acceptable inside a controlled laptop
boundary and unsafe on an exposed host.

[[ADR-0013-review-collaboration-permission]] prevents both review role scopes in
one session, but an untrusted bootstrap client can mint multiple identities and
tokens. Hosted identity must therefore precede worker registration and session
creation, and later authorization must detect policy revocation.

## Decision

Introduce the [[SessionIssuance]] seam with two configuration-selected adapters:

- `trusted-client` preserves the current caller-derived local bootstrap;
- `static` verifies a service credential and replaces caller-selected identity,
  capabilities, permissions, and workspace bindings with one server policy
  grant.

`ACP_SESSION_ISSUER` selects the adapter. Local, single-node, and self-host-ha
default to `trusted-client` for compatibility; those defaults make no public
hosting claim. The `hosted` profile defaults to `static` and may not override
auth, workspace binding, or issuance back to an open posture. Static mode also
requires `ACP_REQUIRE_AUTH=true` and
`ACP_REQUIRE_WORKSPACE_BINDINGS=true`. Invalid combinations fail before the
listener becomes ready.

### Static policy

`ACP_SESSION_ISSUANCE_POLICY` is a JSON document decoded and validated at
startup:

```json
{
  "issuer_id": "acp-static-v1",
  "principals": [
    {
      "id": "principal_ci",
      "revision": "2026-07-15.1",
      "enabled": true,
      "credential_sha256": "<64 lowercase hex characters>",
      "worker": {
        "id": "agent_ci",
        "name": "CI agent",
        "kind": "ci",
        "status": "online",
        "capabilities": ["can_run_commands"]
      },
      "permissions": ["workspace:read", "work:create"],
      "workspace_ids": ["workspace_example"]
    }
  ]
}
```

The decoder requires nonempty issuer/principal/revision identifiers, lowercase
SHA-256 digests, nonempty workspace bindings, unique principal ids, unique
credential digests, and unique worker ids. Permissions use the closed v0.1
vocabulary and retain the ADR-0013 mutually-exclusive role refinement.

Clients present the preimage credential in `Authorization: Bearer <credential>`
while calling `session.initialize`. Static issuance hashes the presented value,
compares fixed-size digests without early identity disclosure, and never logs
the credential or configured digest. On success the caller's protocol version
is honored, but the policy grant replaces every authority-bearing body field.
The response echoes the effective server-derived grant. Permissions,
capabilities, and workspace ids are rejected when duplicated and canonicalized
to stable sorted arrays before persistence/validation, so JSON ordering cannot
accidentally revoke an unchanged revision.

The first successful issuance durably and atomically records the immutable
`(issuer_id, principal_id) ↔ worker_id` attribution in one versioned registry
row through [[Storage]]. Later issuance must match both directions. Rename may
change display metadata; deprovisioning never deletes or releases the principal
or worker id. This prevents a later policy from reusing a historical worker id
and corrupting durable ACP attribution.

The same header has a phase-specific meaning: it is an issuance credential on
`session.initialize` and an opaque ACP session id on every protected operation.
This avoids a transport-specific bootstrap header. CLI and stdio use
`ACP_RPC_TOKEN`; native RPC uses per-call headers; JSON-RPC HTTP/WebSocket
preserve the connection Authorization value when dispatching initialize.

WebSocket query-token compatibility is restricted to already-minted ACP session
ids. Static issuance credentials must arrive in the handshake Authorization
header; `?token=` is never accepted for bootstrap because URLs are routinely
logged. `events.subscribe` authorizes `event:read`, workspace binding, and
current issuer provenance before acknowledging or reading [[EventStream]].

### Session provenance and revocation

Static sessions persist issuer id, principal id, and principal revision as
internal issuance provenance. Every REST and native-RPC authorization validates
that provenance against the active policy before checking scopes or workspace
bindings. A session is unauthorized when its principal is absent or disabled,
its revision changed, its worker changed, or its stored grant differs from the
active policy.

Operators revoke a principal by setting `enabled: false`, or revoke all of its
existing sessions while retaining the credential by changing `revision`, then
restarting/redeploying every replica with the same policy. Startup-loaded
policy makes this deterministic across adapters and avoids partially reloaded
replicas. Hot reload and individual-session revocation are future adapters, not
implicit promises of the static adapter.

### Audit contract

Every issuance decision and revoked-session denial emits a structured security
log containing issuer, principal when known, decision, reason class, derived
worker, permissions, and workspace bindings. Credentials, session ids, and
credential digests are prohibited. ACP does not silently claim its application
event store is a security log; hosted operators must retain server JSON logs in
their normal audit sink.

### OpenAPI contract

The generated OpenAPI document defines `AcpIssuance` as an HTTP bearer scheme.
Session initialization advertises optional issuance auth (`AcpIssuance` or the
empty local alternative); every other operation remains protected by
`AcpSession`. This is one protocol `0.1` operation with deployment-selected
security, not a new route or protocol version.

## Invariants

- Static mode never registers a caller-supplied worker or persists
  caller-supplied scopes/bindings.
- Unknown, missing, disabled, or malformed issuance credentials return the same
  `401 unauthorized` envelope.
- One principal has one worker and one grant. Duplicate principals, workers, or
  credential digests fail startup.
- Historical principal↔worker bindings are immutable and survive deprovisioning.
- A policy revision change invalidates every older session for that principal.
- Static mode cannot run with unauthenticated or host-wide session fallbacks.
- Credential material never appears in responses, logs, errors, or persisted
  session provenance.
- REST, native Effect RPC, JSON-RPC HTTP/WebSocket, CLI, and stdio share the same
  decision and revoked-session validation.
- WebSocket subscriptions cannot bypass `event:read`, workspace bindings, or
  issuer revocation, and URL query values cannot act as issuance credentials.
- Policy parse/decode defects are sanitized; raw JSON and credential digests do
  not appear in startup errors.

## Acceptance Evidence

1. Local trusted-client bootstrap remains byte-compatible.
2. Hosted/static startup fails without a valid policy or with auth/binding
   disabled.
3. Missing and wrong credentials cannot mint a session.
4. A valid credential paired with hostile worker, scope, and workspace fields
   receives only the policy grant.
5. Reusing the credential across sessions cannot split respondent and
   collaborator roles for one principal.
6. After a revision change and real Docker restart, the old session is denied
   and a newly issued session carries the new revision.
7. REST, native RPC, JSON-RPC HTTP/WebSocket, and stdio prove the same bootstrap
   behavior against the compiled production image.
8. Security logs contain required attribution and exclude the secret and its
   digest.
9. WebSocket subscription attempts with no session, missing `event:read`, a
   foreign binding, or a revoked session fail before acknowledgement.
10. A policy cannot remap a persisted principal or worker id, including after
    deprovisioning and restart.

## Consequences

ACP gains a deployable service-identity boundary without forcing OIDC into local
development. The static adapter is deliberately operational: policy rotation
requires coordinated restart and log retention belongs to the platform. The
seam can later accept OIDC/workload-identity adapters without changing session
initialization or downstream authorization.

## Rejected Alternatives

**Protect initialize with an ACP session** — rejected because it creates a
bootstrap cycle.

**Store plaintext credentials in policy** — rejected because configuration and
diagnostics would expose bearer material.

**Trust requested fields up to a maximum** — rejected for the first hosted
adapter; a server-owned fixed grant is easier to audit and cannot accidentally
widen when clients change.

**JWT/OIDC in the first adapter** — rejected as an ungrounded identity-provider
commitment. The seam and hostile-client contract land first; a later OIDC
adapter must validate issuer, audience, signature, time claims, and subject
mapping without changing the domain grant.

**Worker-id-only role separation** — rejected because caller-selected worker ids
are not external identity.

## Referenced by

[[SessionIssuance]] · [[trusted-session-issuance]] ·
[[ADR-0008-deployment-storage-topology]] ·
[[ADR-0013-review-collaboration-permission]] · [[deployment]] ·
[[acp-router]] · [[agent-integration]] · [[decisions/_MOC]] ·
[[2026-07-15-trusted-session-issuance]]
