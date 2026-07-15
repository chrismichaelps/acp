---
type: seam
status: active
capacity: 5
lifecycle: CRITICAL
drift: 0
tags: [seam, critical, auth, identity]
aliases: [SessionIssuance, session issuer]
---

# Session Issuance

## Purpose

Convert a transport credential plus an untrusted session request into a
server-approved worker and authorization grant, then validate that grant on
every later authenticated request. [[ADR-0015-trusted-session-issuance]] owns
the exact hosted security contract.

## Interface

The domain port accepts an optional bearer credential and a normalized requested
grant, and returns an effective grant with optional issuance provenance. It also
validates a persisted session against the current issuer policy. Authorization
failures are typed `UnauthorizedError`; issuance can also surface a typed
`StorageError` when the durable attribution registry is unavailable. Callers
never learn which credential, principal, or policy field failed.

## Adapters

- **Trusted client** — production local/self-host compatibility adapter; returns
  the normalized request and records no external provenance.
- **Static service identity** — production hosted adapter; SHA-256 credential
  lookup, fixed server-owned grant, revision-based revocation, and structured
  audit.

Two real adapters make this boundary CRITICAL. OIDC/workload identity is a
future adapter, not a flag inside the static verifier.

## Algorithm

1. Normalize the transport request to protocol worker/session types.
2. Select the configured adapter once through the application layer.
3. Issue a grant or return opaque unauthorized.
4. Persist static provenance with the minted ACP session.
5. Atomically retain the immutable [[Principal]]↔[[Worker]] attribution in
   [[Storage]].
6. Before scope checks, validate provenance and exact grant equality against the
   active policy.

## Negative Logic

- Do not let transport handlers interpret policy JSON.
- Do not expose credential hashes or distinguish unknown from disabled
  principals.
- Do not treat ACP worker ids as verified external identity.
- Do not bypass validation for JSON-RPC, WebSocket, stdio, or native RPC.
- Do not silently hot-reload one replica.

## Depth

DEEP (0.81). A small issue/validate port hides credential technology, policy
decoding, constant-shape matching, grant derivation, revocation, and audit from
every transport.

## Referenced by

[[seams/_MOC]] · [[ADR-0015-trusted-session-issuance]] ·
[[session-issuer]] · [[session-issuer-live]] · [[trusted-session-issuance]] ·
[[architecture/_MOC]]
