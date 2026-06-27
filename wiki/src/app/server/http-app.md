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

The running ACP **host** as one import-safe `Layer`: [[acp-router]] served over the
full in-memory application ([[app-live]]) and id/clock minting ([[id-clock]]),
**plus the background [[sweeper]] daemon merged over the same shared app** so the
HTTP router and the TTL eviction loop act on one `Storage` instance. It is
socket-agnostic — the listening socket is supplied separately so the exact same
composition runs in two places:

- [[server-main]] binds it to a production `NodeHttpServer` on `ACP_PORT`.
- the **live-boot smoke test** binds it to an ephemeral OS port (`port: 0`).

This is the seam that lets a test prove the composition root wires
`AppLive ⊕ IdClockLive ⊕ acpRouter` correctly over a real socket, without the
test importing [[server-main]] (whose module-scope `runMain` would bind 4317 on
import).

## Interface

### Signatures

```typescript
export const HttpAppLive: Layer.Layer<never, never, HttpServer.HttpServer>
```

### Linkage

- **Requires:** [[acp-router]], [[sweeper]], [[app-live]], [[id-clock]],
  `@effect/platform` `HttpServer`. The residual requirement is
  `HttpServer.HttpServer` — the socket, provided by whoever launches the layer.
- **Consumed by:** [[server-main]] (production socket) and `live-boot.test.ts`
  (ephemeral socket). Re-exported by [[server-index]].

## Algorithm

1. `Layer.mergeAll(HttpServer.serve(acpRouter), SweeperLive)` — the router request
   loop and the [[sweeper]] daemon, both as scoped forked fibers.
2. `Layer.provide(AppLive ⊕ IdClockLive)` — one memoized app runtime satisfies both
   the router's and the sweeper's service context (the shared store), leaving only
   `HttpServer.HttpServer` outstanding.

No behavior of its own; pure composition.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT provide a socket layer here — `HttpAppLive` must stay socket-agnostic
  so production and the smoke test can each bind their own.
- ❌ Do NOT add request logic — that lives in [[acp-router]].
- ❌ Do NOT call `NodeRuntime.runMain` / `Layer.launch` here — launching is the
  entrypoint's job ([[server-main]]); a launch at import time would make this
  module unsafe to import from a test.

## Depth

MEDIUM (0.5). A named composition seam. Exercised end-to-end by `live-boot.test.ts`,
which launches it on an ephemeral port and round-trips
`initialize` → scoped `createWork` over real HTTP — proving the socket boot, the
bearer-token actor resolution, and spec §8 scope enforcement all compose.

## Grill Log

- **Q:** Ephemeral real socket (`port: 0`) or an injected `HttpApp` web handler
  (no socket) for the live-boot test?
  **A:** A real ephemeral socket. *Rationale:* the web-handler path is already
  covered by `router.test.ts` (`HttpApp.toWebHandlerLayer`); the live-boot
  slice's distinct value is proving the *actual* `NodeHttpServer` boot — that
  `HttpServer.serve` + the socket layer + `AppLive` + `IdClockLive` listen and
  serve over TCP. `port: 0` lets the OS assign a free port, so a busy `4317` or
  concurrent runs never collide; the bound port is read back via
  `HttpServer.addressWith`. *Rejected:* re-binding the default `4317` (flaky under
  contention); a second web-handler test (no new coverage over `router.test.ts`).
- **Q:** Should the test import [[server-main]] to test the real composition root?
  **A:** No — extract `HttpAppLive` as an import-safe seam and have **both**
  [[server-main]] and the test depend on it. *Rationale:* [[server-main]] calls
  `NodeRuntime.runMain(Layer.launch(...))` at module scope, so importing it would
  bind `ACP_PORT` 4317 as a side effect of the test. The seam is the genuine
  composition (`serve(acpRouter)` over `AppLive ⊕ IdClockLive`); only the 3-line
  socket+launch glue is unique to `main.ts`, and that glue stays excluded from
  unit tests by design (see [[server-main#Depth]]). *Rejected:* an
  `import.meta`-guarded `runMain` in `main.ts` (a less idiomatic entrypoint than a
  clean seam split).

## Referenced by

[[server-index]] · [[server-main]] · [[acp-router]] · [[Transport]] · [[src/_MOC]]
