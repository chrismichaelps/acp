---
date: 2026-06-25
topic: protocol-schema-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Protocol Schema Slice

## Done

- FMCF Mode 1 vault scaffolded and merged (PR #1): grammar, domain glossary,
  [[architecture/LANGUAGE]], seams, [[ADR-0001-architecture-foundation]], MOCs.
- Protocol-schema slice projected to code and verified:
  branded [[ids]], [[common]] vocabularies, 8 entity schemas, [[event.schema]],
  [[error.schema]], tagged [[protocol-error]], [[app-config]].
- Gate green: `tsc --noEmit` clean · ESLint clean · Prettier clean · 14 tests pass.

## Decided (do not re-litigate)

- Name = **ACP**; env prefix `ACP_`; URI `acp://` ([[ADR-0001-architecture-foundation]]).
- Optional domain fields decode to `Option` via `Schema.optionalWith(..., {as:'Option', nullable:true})`.
- `toProtocolError` is the single total error→wire mapping (spec §15); `StorageError`
  collapses to `internal_error` with no internal leakage.
- Config errors are fatal at startup (`Effect.orDie`).
- Storage stays InMemory-first behind the [[Storage]] seam; SQLite is a future adapter.

## Open / Remaining (next slices, in order)

1. [[Storage]] seam interface (`Context.Tag`) + InMemory adapter (`HashMap`-backed),
   swappable Layer; SQLite adapter deferred.
2. EventStore service (Effect `PubSub`) writing/replaying [[Event]]s with monotonic `seq`.
3. Domain services — start with WorkUnit (the state machine in [[WorkUnit]]); then
   Worker, Workspace, Lease, Artifact, Checkpoint, Review.
4. HTTP transport via `@effect/platform` `HttpApi` (decode→delegate→encode→error-map),
   wiring [[protocol-error]] at the boundary ([[Transport]]).
5. SSE event stream ([[EventStream]]) + heartbeat from `ACP_SSE_HEARTBEAT`.
6. `apps/server/main.ts` + `apps/cli/main.ts` wiring Node Layers (spec §21 CLI).

## Exact next action

DNA Engineer: author `wiki/src/infrastructure/storage/in-memory-store.md` (mirror the
new folder), design the [[Storage]] `Context.Tag` interface against the
[[Storage]] seam page, run `grillme`, then Shadow projects it to
`src/infrastructure/storage/in-memory-store.ts`. Do not add `@effect/sql` yet.

## Links

[[Storage]] · [[Transport]] · [[EventStream]] · [[event.schema]] · [[protocol-error]]
· [[grammar/typescript]] · [[ADR-0001-architecture-foundation]]
