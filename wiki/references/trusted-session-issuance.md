---
type: reference
status: active
date: 2026-07-15
tags: [auth, hosted, security, operations]
aliases: [hosted issuance, static session issuer]
---

# Trusted Session Issuance

## Purpose

Operate ACP's opt-in hosted service-identity boundary without exposing an open,
caller-authorized session bootstrap. The architectural contract is
[[ADR-0015-trusted-session-issuance]].

## Modes

`ACP_SESSION_ISSUER=trusted-client` preserves local behavior. It is appropriate
only behind a trusted user/network boundary.

`ACP_SESSION_ISSUER=static` requires auth, workspace bindings, and a validated
`ACP_SESSION_ISSUANCE_POLICY`. The hosted profile selects it automatically and
fails closed when the policy is absent or unsafe.

## Create a credential digest

Generate a high-entropy secret outside the repository and configure only its
lowercase SHA-256 digest:

```bash
ISSUANCE_SECRET="$(openssl rand -hex 32)"
ISSUANCE_SHA256="$(printf %s "$ISSUANCE_SECRET" | shasum -a 256 | awk '{print $1}')"
```

Put `ISSUANCE_SHA256` into the principal's `credential_sha256`. Deliver
`ISSUANCE_SECRET` through the deployment secret manager; do not commit it, put
it in the JSON policy, or print it in CI.

## Bootstrap

Use the issuance secret only for initialization:

```bash
ACP_RPC_TOKEN="$ISSUANCE_SECRET" acp session init \
  --worker ignored_by_static_policy \
  --name ignored_by_static_policy
```

The returned `session_id`, effective permissions, and workspace bindings come
from server policy. Replace `ACP_RPC_TOKEN` with that session id for later CLI or
stdio calls. Native RPC clients provide the issuance credential in the
initialize call's Authorization header, then use the returned session id.

For WebSocket JSON-RPC, issuance credentials are header-only. The `?token=`
fallback is retained for browser clients only after bootstrap, using an ACP
session id; never put an issuance secret in a URL. Event subscriptions require
that session to carry `event:read`, the requested workspace binding, and current
issuer provenance.

## Rotation and revocation

- Change `revision` to revoke every existing session for one principal while
  keeping its credential and grant.
- Set `enabled` to false to deprovision the principal and deny new issuance.
- Change `credential_sha256` to rotate the bootstrap credential.
- Redeploy/restart all replicas with one identical policy. Mixed revisions
  intentionally produce inconsistent authorization and are unsupported.
- Never reuse or remap an `(issuer_id, principal_id)` or `worker.id`. ACP keeps
  the first binding as a durable tombstone even after deprovisioning.

After rotation, prove the old session returns `401`, mint a new session when the
principal remains enabled, and inspect retained structured logs for the denied
old revision. Never test by echoing secrets.

## Audit fields

Retain structured server logs containing `security_event`, `issuer_id`,
`principal_id` when known, `decision`, `reason`, `worker_id`, permissions, and
workspace ids. The log contract excludes presented credentials, credential
digests, and ACP session ids.

## Failure posture

Missing/wrong credentials, disabled principals, stale revisions, policy drift,
and tampered persisted grants all return the same `401 unauthorized` contract.
Startup rejects malformed JSON, duplicate identities/digests/workers, empty
bindings, duplicate grant literals, open auth in static mode, and any hosted
trusted-client override. Startup errors sanitize policy contents and digests.
WebSocket subscriptions deny missing scope/binding before acknowledgement.

## Referenced by

[[references/_MOC]] · [[deployment]] · [[agent-integration]] ·
[[ADR-0015-trusted-session-issuance]] · [[SessionIssuance]] ·
[[2026-07-15-trusted-session-issuance]]
