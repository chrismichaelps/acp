---
date: 2026-06-26
topic: workspace-service-slice
from_role: Shadow
to_role: DNA Engineer
status: SLICE_COMPLETE
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Workspace Service Slice

## Done
- [[worker-service]] slice (prior): Worker registry behind [[Storage]].
- **Naming fix:** `HadoofHttpApi`/`hadoof-http-api` → `AcpHttpApi`/`acp-http-api`
  (`HttpApi.make('acp')`) per [[ADR-0001-architecture-foundation]]; mirror page
  [[acp-http-api]] + all wikilinks updated. Historical "Hadoof" mentions remain only
  in the ADR/`00-INDEX` as rejected-name context (intentional).
- [[workspace-service]] projected to code: `create`, `get`, `list`, `update` behind
  [[Storage]] + [[EventStore]], emitting `workspace.created`/`workspace.updated`.
  Wiki page authored first with a Grill Log; mirror pages + MOCs + [[Workspace]]
  backlinks updated.
- Gate green: `tsc --noEmit` clean · ESLint clean · Prettier (src) clean · 49 tests
  pass (was 44; +5 Workspace tests).

## Decided (do not re-litigate)
- A [[Workspace]] **is** the per-workspace [[Event]] scope, so it emits its own
  events (no synthetic entity, unlike the host-scoped [[Worker]]).
- `workspace.archived` is **deferred**: the wire schema (spec §10.2) has no
  lifecycle/`archived` field; archival needs its own slice (schema `state` field or
  soft-delete convention). See [[workspace-service#Grill Log]].
- `update` is a full replacement of an **existing** workspace (`NotFoundError`
  otherwise); `create` is the only new-id path. Caller supplies identity.

## Open / Remaining (next slices, in order)
1. Domain services still to project: **Lease**, Artifact, Checkpoint, Review.
   - Lease is the richest: `LeaseConflictError` path (spec §10.4, §12.7) + TTL/expiry
     (`ACP_DEFAULT_LEASE_TTL` from [[app-config]]). It will need a clock/now input
     and conflict detection over `(workspace, resource_uri)` — the first slice with a
     real concurrency invariant.
2. `apps/server/main.ts` + `apps/cli/main.ts` Node Layer wiring (spec §21).
3. Host-level event stream enabling deferred worker-presence events; workspace
   archival lifecycle.

## Exact next action
DNA Engineer: author `wiki/src/domain/leases/lease-service.md` for the Lease slice
per [[Lease]], spec §10.4 (object), §12.7–12.8 (request/release), §11 Lease Events.
Run `grillme` on: conflict semantics (one active lease per resource_uri per
workspace → `LeaseConflictError`), TTL/expiry representation (store `expires_at`;
is expiry lazy-on-read or does it need a sweeper?), and renew/revoke paths. Then
Shadow projects to `src/domain/leases/lease-service.ts`.

## Links
[[workspace-service]] · [[Workspace]] · [[Lease]] · [[Storage]] · [[EventStore]]
· [[acp-http-api]] · [[grammar/typescript]] · [[ADR-0001-architecture-foundation]]
