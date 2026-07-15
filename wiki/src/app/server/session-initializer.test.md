---
type: test
path: '@root/src/app/server/session-initializer.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [test, auth, session]
aliases: [session-initializer.test]
---

# Session Initializer Tests

## Purpose

Pin the transport-neutral transaction in [[session-initializer]] so REST and
native RPC cannot drift in issuance, registration ordering, secure minting, or
response projection.

## Contract

- trusted-client mode preserves a normalized request and stores no provenance;
- static mode stores and returns only the server-derived worker, permissions,
  workspace bindings, and provenance, even when the hostile request omits its
  own workspace binding;
- unsupported protocol, invalid issuance, and durable binding failure register
  no worker and mint no session;
- the stored and returned grants are identical; and
- session ids come from the secure-token path.

## Negative Logic

- Do not mock separate REST and RPC initializers; exercise the shared function.
- Do not assert credential/digest values in errors or logs.
- Do not permit a failed hostile request to leave partial worker state.

## Referenced by

[[session-initializer]] · [[server/_MOC]] · [[src/_MOC]]
