---
type: module
path: '@root/src/infrastructure/auth/session-issuer-live.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[SessionIssuance]]'
depth_score: 0.86
depth_status: DEEP
tags: [module, deep, auth, security]
aliases: [session-issuer-live, StaticSessionIssuer]
---

# Session Issuer Live

## Purpose

Select and implement the runtime [[SessionIssuance]] adapter from [[app-config]].
Static mode decodes the policy, verifies SHA-256 service credentials, returns a
fixed grant, validates persisted provenance, and emits credential-safe security
audit logs.

## Interface

```typescript
export const bearerCredential: (headers: Headers.Headers) => string
export const SessionIssuerLive: Layer.Layer<
  SessionIssuer,
  never,
  AppConfigTag | Storage
>
```

Policy schemas and digest helpers remain module-private. The Layer dies during
construction on malformed/unsafe static or hosted configuration; runtime
credential and revocation failures use typed `UnauthorizedError`.

## Algorithm

1. Read `sessionIssuer`, raw policy JSON, profile, auth, and binding flags from
   [[app-config]].
2. For trusted-client mode, reject the hosted profile and provide
   `TrustedClientSessionIssuerLive` semantics.
3. For static mode, require auth and workspace bindings; parse JSON and decode
   the complete schema.
4. Validate uniqueness of principal id, worker id, credential digest, and every
   grant array; canonicalize permissions/capabilities/workspaces by sorting.
5. On `issue`, SHA-256 the presented bearer value and compare each fixed-length
   digest without exposing match detail. Missing, wrong, and disabled all map to
   opaque unauthorized.
6. Atomically ensure the immutable bidirectional
   `(issuer_id, principal_id)`↔worker mapping in one global versioned Storage
   registry row using put-if-absent/CAS retry. Worker ids are globally unique
   across historical issuers.
7. Return the matched policy worker/grant and static provenance; ignore every
   authority-bearing caller field.
8. On `validate`, require provenance and exact issuer/principal/revision/worker/
   permissions/bindings equality with one enabled policy principal.
9. Emit accepted/denied/revoked structured logs without credential, digest, or
   session id.

## Edge Cases

- Empty Authorization parses as missing credential.
- Duplicate configuration fails before readiness rather than choosing first.
- Policy array order does not affect grant selection.
- Prior principal/worker attribution survives disabled or removed policy entries
  and rejects either id being reassigned, including through a changed issuer id.
- Old trusted-client sessions are unauthorized when the host enters static mode.
- Revision rotation revokes older sessions even when credential and grant stay
  otherwise equal.

## Negative Logic

- Do not compare plaintext credentials or persist them.
- Do not log presented values, digests, or session ids.
- Do not fall back to trusted-client when static policy parsing fails.
- Do not include raw policy JSON or schema output in startup defects.
- Do not accept host-wide static grants.
- Do not short-circuit into a distinguishable unknown/disabled response.
- Do not use `issuer_id` as the Storage row key; that would partition the global
  worker tombstone index.

## Depth

DEEP (0.86). One Layer hides security-sensitive decoding, matching, grant
derivation, revocation, audit, and adapter selection behind the two-method port.

## Referenced by

[[session-issuer-live.test]] · [[auth/_MOC]] · [[auth-index]] ·
[[SessionIssuance]] · [[app-live]] · [[app-config]]
