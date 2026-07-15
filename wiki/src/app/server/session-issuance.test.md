---
type: test
path: '@root/src/app/server/session-issuance.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[SessionIssuance]]'
tags: [test, integration, auth, hostile-client]
aliases: [session-issuance.test]
---

# Session Issuance Integration Tests

## Purpose

Exercise the live HTTP application with static issuance and hostile caller
inputs, proving the configured [[Principal]] grant—not the request—owns identity,
permissions, workspace bindings, and later authorization.

## Contract

- missing and incorrect issuance credentials receive opaque 401 responses;
- a correct credential replaces hostile worker/scopes/bindings—including an
  omitted caller binding—with the static grant and persists non-secret
  provenance;
- the minted session authorizes only its granted action/workspace;
- disabling or revising the principal in a restarted policy invalidates the old
  session before scope checks; and
- failures and audit records never reveal a credential, digest, raw policy, or
  session id.

## Negative Logic

- Do not use a transport stub; boot the production app layer.
- Do not weaken hostile inputs to values matching the configured grant.
- Do not claim hot reload or per-session revocation; policy is loaded at startup.

## Referenced by

[[session-initializer]] · [[session-issuer-live]] · [[server/_MOC]] ·
[[ADR-0015-trusted-session-issuance]]
