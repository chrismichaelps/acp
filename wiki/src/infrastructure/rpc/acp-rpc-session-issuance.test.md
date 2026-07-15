---
type: test
path: '@root/src/infrastructure/rpc/acp-rpc-session-issuance.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[SessionIssuance]]'
tags: [test, rpc, auth, hostile-client]
aliases: [acp-rpc-session-issuance.test]
---

# Native RPC Session Issuance Tests

## Purpose

Prove native Effect RPC forwards its per-call Authorization bearer into the
shared [[session-initializer]] and cannot retain caller-selected authority in
static mode.

## Contract

- missing and incorrect issuance credentials fail with the same unauthorized
  protocol error;
- a valid credential replaces hostile worker, permissions, capabilities, and
  workspace bindings with the static policy grant;
- the returned ACP session id authorizes a later native RPC using only that
  grant; and
- worker registry state contains the policy worker, never the hostile worker.

## Negative Logic

- Do not copy static policy logic into the handler test.
- Do not bypass native RPC headers by calling the HTTP router.
- Do not let the aggregate handler suite exceed the source-size gate.

## Referenced by

[[acp-rpc-handlers]] · [[session-initializer]] · [[rpc/_MOC]] ·
[[ADR-0015-trusted-session-issuance]]
