---
type: module
path: '@root/src/app/cli/session-auth-flow.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, medium, test]
aliases: [session-auth-flow-test]
---

# Session Auth Flow Test

## Purpose

Prove the authenticated CLI path end to end without opening a socket:
`session init` mints a bearer session through [[acp-router]], and
[[cli-client]] forwards that token on a scoped command when auth is required.

## Interface

```typescript
describe('CLI authenticated session flow', () => {
  it('initializes a session and uses its bearer token for a scoped command', ...)
})
```

## Algorithm

The required-auth fixture remains a local trusted-client issuer with no static
policy so this suite isolates CLI bearer forwarding; hostile issuance belongs to
[[session-issuance.test]].

The test builds the real `acpRouter` web handler over [[app-live]],
[[id-clock]], and a require-auth config layer. A fake `HttpClient` converts
Effect Platform client requests into Web `Request` objects for that handler.
The scenario parses `session init`, runs it through [[cli-client]], extracts the
returned `session_id`, then parses `work create` and runs it with that token.
The final assertion checks that the created work unit is attributed to the
session worker.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT open a real TCP socket; route composition is enough for this
  integration boundary.
- ❌ Do NOT persist the bearer token; the test threads it explicitly like an
  operator exporting `ACP_RPC_TOKEN`.
- ❌ Do NOT bypass [[cli-commands]]; the flow must exercise parser output and
  client request construction together.

## Depth

MEDIUM (0.5). The test is compact, but it protects the auth-critical handoff
between parser, CLI client, session bootstrap, and router authorization.

## Referenced by

[[cli/_MOC]] · [[cli-client]] · [[cli-session-commands]]
