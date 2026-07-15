---
type: module
path: '@root/src/app/server/session-initializer.ts'
fidelity: Active
domain: '[[Principal]]'
grammar: '[[grammar/typescript]]'
seam: '[[SessionIssuance]]'
depth_score: 0.82
depth_status: DEEP
tags: [module, deep, auth, session]
aliases: [session-initializer, initializeSession]
---

# Session Initializer

## Purpose

Own the one transport-neutral initialization transaction used by REST,
JSON-RPC, WebSocket, stdio, and native Effect RPC: validate the handshake,
normalize the untrusted request, obtain an effective grant from
[[session-issuer]], register only the granted [[Worker]], and persist a secure
bearer session with non-secret issuance provenance.

## Interface

```typescript
export const initializeSession: (
  payload: InitializeSessionRequest,
  credential: string,
) => Effect.Effect<
  InitializeSessionResponse,
  ValidationError | UnauthorizedError | StorageError,
  AppConfigTag | IdClock | SessionIssuer | SessionService | WorkerService
>
```

The credential is the decoded bearer value for this initialization request
only. Transports own header/environment extraction; they must not interpret the
credential as a caller-selected worker identity.

## Algorithm

1. Validate `protocol_version` through [[protocol-version]].
2. Normalize draft capability booleans into the canonical [[Worker]] shape and
   preserve the schema-decoded requested permissions/workspace bindings as an
   untrusted `SessionIssuanceRequest`. Enforce the configured binding requirement
   before issuing a trusted-client session; static grants are independently
   required to be nonempty by policy validation.
3. Call [[session-issuer]] `issue`. Trusted-client mode returns the request;
   static mode replaces worker, scopes, bindings, and provenance with the
   configured policy grant after durable principal binding validation.
4. Register the effective worker only after issuance succeeds.
5. Mint the session id with [[id-clock]] `secureToken`, read the current time,
   and persist the exact effective permissions, bindings, and provenance through
   [[session-service]].
6. Return the canonical host descriptor and echo the exact stored grant.

No transport receives an intermediate caller-selected identity after step 3.
Issuance failure happens before worker registration or session minting.

## Negative Logic (Prohibited Paths)

- Do not read HTTP requests, RPC options, process environment, or Node streams.
- Do not duplicate initialization in [[acp-router]] or
  [[acp-rpc-handlers]].
- Do not register the requested worker before policy issuance succeeds.
- Do not reconstruct response scopes or bindings from worker kind/capabilities.
- Do not log credentials, session ids, digests, or raw policy.

## Depth

DEEP (0.82). One transaction hides compatibility normalization, trusted
issuance, worker registration ordering, secure minting, and response projection
from every transport.

## Referenced by

[[session-initializer.test]] · [[session-issuance.test]] · [[acp-router]] ·
[[acp-rpc-handlers]] · [[server/_MOC]] · [[SessionIssuance]]
