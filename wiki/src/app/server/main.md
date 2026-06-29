---
type: module
path: '@root/src/app/server/main.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.4
depth_status: SHALLOW
tags: [module, entrypoint]
aliases: [server-main]
---

# Server Entrypoint

## Purpose

The Node HTTP server entrypoint (spec §21, v0.1 "Local ACP host"). Launches the
[[http-app]] service ([[acp-router]] over [[app-live]] + [[id-clock]]) on a
[[node-http-server]] listening on `ACP_PORT`, wrapped in [[app-logging]] so
production logs are structured JSON with config-driven minimum level,
`service=acp`, `component=server`, and an `acp.server` span. This is the one
place the server Layer is launched (Constitution / [[grammar/typescript]]); the
router/app composition itself lives in the import-safe [[http-app]] seam so tests
can reuse it.

## Interface

### Signatures

```typescript
// side-effecting entrypoint — no exports
NodeRuntime.runMain(Layer.launch(HttpLive))
```

### Linkage

- **Requires:** [[http-app]], [[app-logging]], `@effect/platform-node`
  `NodeRuntime`, [[node-http-server]].
- **Consumed by:** the operator (`node dist/app/server/main.js`).

## Algorithm

1. Provide [[node-http-server]] `NodeHttpServerLive` to [[http-app]].
2. Launch `HttpAppLive` through `NodeRuntime.runMain`.
3. Wrap the
   launch effect with `withAcpJsonLogging('server')`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add request-handling logic here — that lives in [[acp-router]].
- ❌ Do NOT export from this module — it is a runnable entrypoint, excluded from
  [[server-index]].
- ❌ Do NOT log bearer tokens, request bodies, or local file paths at startup.

## Depth

SHALLOW (0.4) by design — a thin launch root (provide socket Layer, launch).
Excluded from unit tests; the launched composition is covered by the [[http-app]]
live-boot smoke test through the same [[node-http-server]] factory, and the router
via a web handler.

## Referenced by

[[server-index]] · [[http-app]] · [[node-http-server]] · [[app-logging]] ·
[[Transport]] · [[src/_MOC]]
