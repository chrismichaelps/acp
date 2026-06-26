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

The Node HTTP server entrypoint (spec §21, v0.1 "Local ACP host"). Composes
[[acp-router]] with [[app-live]] + [[id-clock]] and serves it on a
`NodeHttpServer` listening on `ACP_PORT`. This is the one place Node Layers are
wired (Constitution / [[grammar/typescript]]).

## Interface

### Signatures

```typescript
// side-effecting entrypoint — no exports
NodeRuntime.runMain(Layer.launch(HttpLive))
```

### Linkage

- **Requires:** [[acp-router]], [[app-live]], [[id-clock]], `@effect/platform`
  `HttpServer`, `@effect/platform-node` `NodeHttpServer`/`NodeRuntime`, `node:http`.
- **Consumed by:** the operator (`node dist/app/server/main.js`).

## Algorithm

1. Read `ACP_PORT` (`Config`, default 4317).
2. `NodeHttpServer.layer(() => createServer(), { port })`.
3. `HttpServer.serve(acpRouter)` providing `AppLive ⊕ IdClockLive` then the server
   layer; `NodeRuntime.runMain(Layer.launch(...))`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add request-handling logic here — that lives in [[acp-router]].
- ❌ Do NOT export from this module — it is a runnable entrypoint, excluded from
  [[server-index]].

## Depth

SHALLOW (0.4) by design — a thin wiring root. Excluded from unit tests; the router
is tested via a web handler.

## Referenced by

[[server-index]] · [[Transport]] · [[src/_MOC]]
