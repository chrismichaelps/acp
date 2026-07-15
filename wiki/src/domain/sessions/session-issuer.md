---
type: module
path: '@root/src/domain/sessions/session-issuer.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[SessionIssuance]]'
depth_score: 0.81
depth_status: DEEP
tags: [module, deep, auth, seam]
aliases: [session-issuer, SessionIssuer]
---

# Session Issuer

## Purpose

Define the transport-neutral port that turns an untrusted normalized session
request plus optional bearer credential into an effective server grant, and
validates static issuance provenance on every later authenticated request.

## Interface

```typescript
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

export const TrustedClientSessionIssuerLive: Layer.Layer<SessionIssuer>
```

The trusted-client adapter returns the request unchanged, adds no provenance,
and validates existing sessions unchanged. It is explicit compatibility policy,
not an absence of the seam.

## Algorithm

1. Receive only schema-decoded protocol types; transport header parsing stays at
   the infrastructure boundary.
2. In trusted-client mode, return the normalized request with `Option.none`
   provenance.
3. In static mode, [[session-issuer-live]] provides the same port and returns a
   policy grant with `Option.some` provenance after atomically preserving the
   principal-to-worker binding through [[Storage]].
4. Downstream session creation stores the effective grant; downstream auth calls
   `validate` before scope and workspace checks.

## Negative Logic

- Do not import HTTP requests, RPC options, Node crypto, or environment config.
- Do not mint session ids or register workers.
- Do not expose a boolean validation result that callers can accidentally
  ignore; return the validated session or fail typed unauthorized.
- Do not map identity from caller worker ids in the static adapter.

## Depth

DEEP (0.81). Two methods hide all issuer technology and keep six transports plus
two authorization stacks from understanding policy.

## Referenced by

[[session-issuer.test]] · [[sessions/_MOC]] · [[sessions-index]] ·
[[session-issuer-live]] · [[SessionIssuance]] · [[acp-router]] ·
[[acp-rpc-handlers]] · [[route-support]] · [[rpc-auth]]
