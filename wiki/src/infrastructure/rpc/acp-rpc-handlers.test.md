---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-handlers.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, handlers]
aliases: [acp-rpc-handlers.test]
---

# ACP RPC Aggregate Handler Tests

## Purpose

Prove [[acp-rpc-handlers]] session/worker/workspace, work, and lease verticals,
including scopes, workspace bindings, typed errors, lifecycle delegation, and
middleware actor attribution.

## Interface

Vitest `accessHandler` suite over normal, app-visible, and required-binding
native RPC runtimes.

## Algorithm

Initialize sessions and perform scoped worker/workspace reads; reject missing
read scope. Require native initialization to echo exact permissions, including
each ADR-0013 literal in a separate session. Reject the two-literal pair with
the exact mutual-exclusion issue and prove no session was persisted. Persist
declared workspace bindings and, when configured, reject
missing/empty bindings. Deny direct workspace/work/lease calls outside a session
binding. Exercise workspace create/update/archive and work create/list/get/
claim/run/progress. Exercise lease request/list/renew/release/revoke and conflict.
Finally, provide `AcpRpcActor` and require work creation attribution despite an
invalid bearer token.

For static issuance, pass the credential through native request headers and
prove hostile worker/scopes/bindings are replaced by the server grant. Missing
or wrong credentials fail before worker registration; a stale policy revision
is unauthorized before scope checks. These assertions exercise the shared
[[session-initializer]], not a native-only policy path.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT treat permission scope as sufficient when workspace binding denies.
- ❌ Do NOT accept missing bindings in hardened hosted mode.
- ❌ Do NOT collapse typed forbidden/conflict errors into defects.
- ❌ Do NOT duplicate workspace, work, or lease lifecycle rules in RPC.
- ❌ Do NOT override middleware actor identity with bearer fallback.
- ❌ Do NOT infer native response projection from the shared success schema.
- ❌ Do NOT allow one native session to carry both ADR-0013 role scopes.
- ❌ Do NOT trust native caller identity fields when static issuance is selected.

## Grill Log

- **Q:** Why test direct bindings separately from derived-resource scope suites?
  **A:** This suite pins payload/query workspace ids; sibling suites prove lookup-
  derived tenant scope for resource ids. _Rejected:_ assuming one authorization
  path certifies the other.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-auth]] · [[rpc-resource-workspace-auth]] ·
[[rpc/_MOC]] · [[Transport]] · [[src/_MOC]]
