---
date: 2026-06-27
topic: live-boot-smoke-test-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Live-Boot Smoke Test Slice (real-socket composition root)

## Done
- Extracted the [[http-app]] seam: `HttpAppLive` =
  `HttpServer.serve(acpRouter)` provided with `AppLive ⊕ IdClockLive`, leaving the
  listening socket (`HttpServer.HttpServer`) as its only residual requirement.
- [[server-main]] now launches `HttpAppLive` over its `ACP_PORT` socket (3-line
  glue: read port → `NodeHttpServer.layer` → `Layer.launch`). [[server-index]]
  re-exports `HttpAppLive`.
- Added `live-boot.test.ts`: binds a **real** `NodeHttpServer` on an ephemeral
  port (`port: 0`), reads the bound port via `HttpServer.addressWith`, and
  round-trips `POST /v1/session/initialize` → scoped `POST /v1/work` over HTTP —
  asserting `200`/`session_*`/`protocol_version 0.1`, then `201`/`state: open`/
  `created_by: agent_claude_code`. Proves socket boot + bearer actor resolution +
  spec §8 scope enforcement compose.
- Wiki: new [[http-app]] page (2 Grill entries); [[server-main]], [[server-index]],
  server `_MOC` refreshed; CHANGELOG entry.
- Gate green: `tsc` · ESLint · Prettier (src) · **105 tests** (was 104; +1 live-boot;
  21 test files).

## Decided (do not re-litigate)
- **Real ephemeral socket, not a web handler.** The web-handler path is already
  covered by `router.test.ts`; the live-boot test's value is the actual TCP boot.
  `port: 0` avoids `4317` contention and concurrent-run collisions.
- **Import-safe seam, not importing `main.ts`.** `main.ts` runs `runMain` at
  module scope (binds 4317 on import), so the shared composition lives in
  `http-app.ts`; both the entrypoint and the test depend on it.
- `main.ts` stays SHALLOW and unit-test-excluded — only its socket+launch glue is
  unique, and that is covered transitively by booting `HttpAppLive`.

## Open / Remaining (post-v0.1)
1. **Session/lease expiry sweeper**: TTL eviction fiber (sessions + leases);
   currently `session_id` is a non-expiring bearer token and leases never lapse.
2. **Mandatory auth + credential issuance**: once the host can mint real tokens,
   flip unauthenticated mutations from `worker_system` to `401`.
3. **JSON-RPC transport** — **v0.2** per spec §7/§13 (Optional); HTTP+SSE is MVP.

## Exact next action
DNA Engineer: pick the **session/lease expiry sweeper** slice. Author a wiki page
for a TTL eviction fiber (a scoped background `Effect` forked at composition root)
that evicts expired [[session.schema]] sessions and lapses overdue [[Lease]]s,
emitting the appropriate events on lapse. `grillme`: wall-clock `Clock.sleep` poll
loop vs. per-entity scheduled expiry; where the fiber is forked (in [[http-app]]'s
scope so it lives exactly as long as the server, vs. a separate layer); and whether
lease expiry emits a `lease.released`-style event through [[event-store]].

## Links
[[http-app]] · [[server-main]] · [[server-index]] · [[acp-router]] · [[app-live]]
· [[id-clock]] · [[session-service]] · [[Transport]] · [[ADR-0001-architecture-foundation]]
