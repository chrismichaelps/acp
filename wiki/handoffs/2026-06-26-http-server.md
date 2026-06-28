---
date: 2026-06-26
topic: http-server-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — HTTP Server Slice

## Done

- [[acp-router]] `HttpRouter` binds all 12 spec §12 routes to the domain services,
  reusing [[http-error-mapper]] for correct-status errors and [[sse-event-stream]]
  for `GET /v1/events/stream`. [[id-clock]] mints ids/timestamps; [[server-main]] is
  the Node `NodeHttpServer` entrypoint on `ACP_PORT`. Wiki pages + server MOC +
  CHANGELOG written.
- Gate green: `tsc` · ESLint · Prettier (src) clean · **83 tests** (was 76; +2
  IdClock, +5 router via `HttpApp.toWebHandlerLayer`).

## Decided (do not re-litigate)

- **Manual `HttpRouter`, not `HttpApiBuilder`** — reuses the existing correct-status
  `toHttpErrorResponse` and leaves the merged [[acp-http-api]] contract untouched.
  See [[acp-router#Grill Log]].
- **Fixed `worker_system` actor** for mutations whose payloads omit an actor
  (`createWork`, `PATCH state`, `release`, `publishWorkEvent`). Session-bound actor
  resolution waits on the auth slice (spec §8 bearer tokens).
- [[id-clock]] is a composition-root primitive (counter + Effect `Clock`), not yet a
  swappable seam.
- [[server-main]] is excluded from [[server-index]] (side-effecting entrypoint) and
  not unit-tested; the router is tested via a web handler.

## Open / Remaining (v0.1)

1. **CLI entrypoint** (spec §21): `acp init · workspace add · work create · work
claim · lease request · checkpoint create · artifact create · review request ·
events stream`. Use `@effect/platform` `Command`/`Args`/`Options` over the same
   `AppLive`, OR shell out to the HTTP server. This is the **last v0.1 slice**.
2. Post-v0.1: bearer-token auth + session-bound actor; live boot smoke test;
   lease-expiry sweeper; workspace archival; JSON-RPC transport (v0.2).

## Exact next action

DNA Engineer: author `wiki/src/app/cli/cli.md` for the CLI slice — a
`@effect/platform` `Command` tree mapping each subcommand to a domain-service call
over [[app-live]], printing JSON results. `grillme`: in-process (call services
directly) vs HTTP client to [[acp-router]]. Then Shadow projects to
`src/app/cli/`.

## Links

[[acp-router]] · [[id-clock]] · [[server-main]] · [[app-live]] · [[acp-http-api]]
· [[http-error-mapper]] · [[sse-event-stream]] · [[grammar/typescript]]
· [[ADR-0001-architecture-foundation]]
