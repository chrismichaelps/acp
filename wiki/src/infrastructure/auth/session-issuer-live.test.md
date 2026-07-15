---
type: module
path: '@root/src/infrastructure/auth/session-issuer-live.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, auth, security]
aliases: [session-issuer-live.test]
---

# Session Issuer Live Tests

## Purpose

Provide deterministic hostile-input and revocation coverage for
[[session-issuer-live]] without Docker or transport noise.

## Interface

Vitest constructs `AppConfigTag` test values and executes the public
[[session-issuer]] port.

## Algorithm

- Fail Layer creation for missing/malformed policy, unsafe auth/binding flags,
  hosted trusted-client, duplicate principal/worker/digest, invalid digest, and
  empty bindings/duplicate grant literals; assert sanitized defects exclude raw
  JSON and digests.
- Deny missing, wrong, and disabled credentials with one unauthorized shape.
- Derive worker, capability, permission, and workspace grant from policy despite
  hostile requested fields.
- Validate current provenance and deny missing, stale revision, changed worker,
  changed permission, and changed binding.
- Capture logs and assert attribution fields exist while secret, digest, and
  session id do not.
- Prove canonical array order and durable bidirectional principal/worker CAS;
  deny historical remapping after disable/removal, a fresh Layer over the same
  Storage, and an issuer-id change.
- Verify Authorization parsing accepts bearer case-insensitively and rejects
  other schemes/empty values.

## Negative Logic

- Do not weaken constant-shape behavior with error-message assertions that reveal
  principal state.
- Do not substitute these tests for compiled Docker cross-transport proof.

## Depth

DEEP test module: it protects the full security decision table and negative
logic of a critical seam.

## Referenced by

[[session-issuer-live]] · [[auth/_MOC]] · [[SessionIssuance]]
