---
type: module
path: '@root/src/app/server/http-app.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [http-app, http-app-live]
---

# HTTP Application Layer

## Purpose

The running ACP **host** as one import-safe `Layer`: [[native-rpc-route]]
registers REST/JSON-RPC routes plus `/rpc/native` over the full application
([[app-live]]) and id/clock minting ([[id-clock]]), **plus the background
[[sweeper]] daemon and [[sweeper-leadership]] merged over the same shared app**
so every transport and the TTL eviction loop act on one `Storage` instance. It is
socket-agnostic — the
listening socket is supplied separately so the exact same composition runs in
two places:

- [[server-main]] binds it to [[node-http-server]] on `ACP_PORT`.
- the **live-boot smoke test** binds it to an ephemeral OS port (`port: 0`).

This is the seam that lets tests prove the composition root wires
`AppLive ⊕ IdClockLive ⊕ AcpHttpRoutesLive` correctly over a real socket,
without importing [[server-main]] (whose module-scope `runMain` would bind 4317
on import).

## Interface

### Signatures

```typescript
export const HttpAppLive: Layer.Layer<
  never,
  StorageError,
  HttpServer.HttpServer
>
```

### Linkage

- **Requires:** [[native-rpc-route]], [[sweeper]], [[app-live]], [[id-clock]],
  [[protocol-error]] (`StorageError`), `@effect/platform` `HttpLayerRouter`, and
  `@effect/platform` `HttpServer`. The residual requirement is
  `HttpServer.HttpServer` — the socket, provided by [[node-http-server]] or
  tests.
- **Consumed by:** [[server-main]] (production socket) and `live-boot.test.ts`
  (ephemeral socket). Re-exported by [[server-index]].

## Algorithm

1. `Layer.mergeAll(HttpLayerRouter.serve(AcpHttpRoutesLive, { disableLogger:
true }), SweeperLive)` — the route request loop and the [[sweeper]] daemon,
   both as scoped forked fibers. The platform logger is disabled because it
   records `HttpServerRequest.url` verbatim, including compatibility query
   tokens. [[route-support]] and native RPC telemetry remain the canonical,
   low-cardinality request logs.
2. Build `ServerRuntimeLive` as `AppLive ⊕ IdClockLive ⊕ SweeperLeadershipLive`.
   `SweeperLeadershipLive` is provided from the same app runtime so Postgres
   leader election reads the same config as storage.
3. Provide `ServerRuntimeLive`, leaving only `HttpServer.HttpServer`
   outstanding.

No behavior of its own; pure composition.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT provide a socket layer here — `HttpAppLive` must stay socket-agnostic
  so production and the smoke test can each bind their own.
- ❌ Do NOT add request logic — REST/legacy JSON-RPC behavior lives in
  [[acp-router]], and native RPC behavior lives in [[acp-rpc-handlers]].
- ❌ Do NOT call `NodeRuntime.runMain` / `Layer.launch` here — launching is the
  entrypoint's job ([[server-main]]); a launch at import time would make this
  module unsafe to import from a test.
- ❌ Do NOT enable Effect Platform's default HTTP logger while it records raw
  request URLs; bearer query tokens must never enter container logs.

## Depth

MEDIUM (0.5). A named composition seam. Exercised end-to-end by
`live-boot.test.ts`, which launches it on an ephemeral port and round-trips
`initialize` → scoped `createWork` over real HTTP, and by
`native-rpc-route.test.ts`, which drives `/rpc/native` through the generated
client and reads the result back through REST — proving socket boot,
bearer-token actor resolution, spec §8 scope enforcement, and shared transport
state all compose.

## Grill Log

- **Q:** Ephemeral real socket (`port: 0`) or an injected `HttpApp` web handler
  (no socket) for the live-boot test?
  **A:** A real ephemeral socket. _Rationale:_ the web-handler path is already
  covered by `router.test.ts` (`HttpApp.toWebHandlerLayer`); the live-boot
  slice's distinct value is proving the _actual_ `NodeHttpServer` boot — that
  `HttpServer.serve` + the socket layer + `AppLive` + `IdClockLive` listen and
  serve over TCP. `port: 0` lets the OS assign a free port, so a busy `4317` or
  concurrent runs never collide; the bound port is read back via
  `HttpServer.addressWith`. The test uses [[node-http-server]]
  `nodeHttpServerLayer(0)`, so the same platform boundary builds production and
  ephemeral sockets. _Rejected:_ re-binding the default `4317` (flaky under
  contention); a second web-handler test (no new coverage over `router.test.ts`).
- **Q:** Should the test import [[server-main]] to test the real composition root?
  **A:** No — extract `HttpAppLive` as an import-safe seam and have **both**
  [[server-main]] and the test depend on it. _Rationale:_ [[server-main]] calls
  `NodeRuntime.runMain(Layer.launch(...))` at module scope, so importing it would
  bind `ACP_PORT` 4317 as a side effect of the test. The seam is the genuine
  composition (`serve(acpRouter)` over `AppLive ⊕ IdClockLive`); only the 3-line
  socket+launch glue is unique to `main.ts`, and that glue stays excluded from
  unit tests by design (see [[server-main#Depth]]). _Rejected:_ an
  `import.meta`-guarded `runMain` in `main.ts` (a less idiomatic entrypoint than a
  clean seam split).
- **Q:** Keep the framework request logger and attempt to sanitize selected query
  keys, or disable it in favor of ACP's template-based telemetry?
  **A:** Disable it. _Rationale:_ ACP already emits route-template, status,
  duration, and error-code records without identifiers; the framework logger
  adds a duplicate raw URL whose query string can contain bearer credentials.
  _Rejected:_ maintaining a partial sensitive-query-key denylist (easy to drift
  as compatibility parameters evolve).

## Referenced by

[[live-boot.test]] · [[native-rpc-route.test]] · [[server-index]] ·
[[server-main]] · [[native-rpc-route]] · [[acp-router]] · [[Transport]] ·
[[src/_MOC]]
