---
date: 2026-06-26
topic: worker-service-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Worker Service Slice

## Done

- [[worker-service]] projected to code behind the [[Storage]] seam: `register`
  (idempotent upsert), `get`, `list`, `setStatus`. Wiki page authored first with a
  Grill Log; mirror pages [[worker-service-index]] + workers `_MOC` created;
  [[src/_MOC]], domain `_MOC`, and [[Worker]] backlinks updated.
- Gate green: `tsc --noEmit` clean · ESLint clean · Prettier clean · 44 tests pass
  (was 38; +6 Worker tests).

## Decided (do not re-litigate)

- WorkerService is a **registry**, not a state machine: any `WorkerStatus` is
  reachable from any other (presence has no invariant ordering).
- `register` is an **upsert** — `session/initialize` is re-invoked on reconnect.
- **No per-workspace presence events this slice.** The [[Event]] log is
  per-workspace ([[EventStore]] appends to `storage.appendEvent(workspaceId)`) but a
  [[Worker]] is host-scoped. `worker.online`/`worker.status_changed` are deferred to
  a future host/global event-stream slice rather than inventing a synthetic
  workspace. See [[worker-service#Grill Log]].
- The caller supplies `WorkerId`; the service never mints identity (consistent with
  the WorkUnit slice — no ID/clock seams yet).

## Open / Remaining (next slices, in order)

1. Domain services still to project (handoff order): Workspace, Lease, Artifact,
   Checkpoint, Review. [[WorkUnit]] and [[Worker]] are done.
   - Lease is the richest — it carries the `LeaseConflictError` path (spec §10.4,
     §12.7) and a TTL/expiry concern (`ACP_DEFAULT_LEASE_TTL` from [[app-config]]).
2. `apps/server/main.ts` + `apps/cli/main.ts` wiring Node Layers (spec §21 CLI),
   composing the domain services + [[Transport]] + [[EventStream]].
3. Host-level event stream enabling deferred worker-presence events.

## Exact next action

DNA Engineer: author `wiki/src/domain/workspaces/workspace-service.md` (mirror the
new folder) for the next slice — Workspace registry/lifecycle per [[Workspace]] and
spec §10.2 / §11 Workspace Events / §12.2. Run `grillme` (does Workspace emit its
own `workspace.created`/`updated`/`archived` events? — unlike Worker, a Workspace
_is_ the per-workspace event scope, so it likely should), then Shadow projects it to
`src/domain/workspaces/workspace-service.ts`.

## Links

[[worker-service]] · [[Worker]] · [[Storage]] · [[EventStore]] · [[work-unit-service]]
· [[grammar/typescript]] · [[ADR-0001-architecture-foundation]]
