---
type: adr
status: ACCEPTED
date: 2026-06-28
tags: [adr, events, workers]
aliases: [ADR-0005, ADR-0005-worker-presence-scope]
---

# ADR-0005 — Worker Presence Scope

## Status

ACCEPTED — 2026-06-28.

## Context

Spec §11 lists `worker.online`, `worker.offline`, and `worker.status_changed`
beside workspace, work, lease, artifact, checkpoint, and review events. The same
draft defines [[Event]] with a required `workspace_id`, and the v0.1 reference
host implements [[event-store]] as a workspace-scoped append-only log with
workspace-filtered live subscribers.

That shape is correct for work history, but it is not correct for presence.
[[Worker]] registration happens during `session.initialize`, before a worker is
necessarily bound to any [[Workspace]]. A worker may also operate across several
workspaces during one host lifetime. Publishing presence into a workspace log
would make workspace replay include facts that are not workspace facts.

[[worker-service]] already owns the durable worker registry and status field. It
does not own a clock, a workspace, or [[event-store]], and that is intentional.

## Decision

ACP v0.1 treats worker presence as host-scoped registry state, not as
workspace-scoped event history. `worker.online`, `worker.offline`, and
`worker.status_changed` remain vocabulary reserved by the draft, but the
reference implementation does not emit them through [[EventStore]], expose
transport commands for them, or synthesize a pseudo-workspace to carry them.

`session.initialize` continues to register or refresh the [[Worker]] record.
`WorkerService.setStatus` remains the local domain operation for status mutation.
If a future integration needs live host presence, ACP must add a distinct
host-event or presence-feed model instead of reusing the workspace event log.

## Rationale

Presence is connection and host state. Workspace events are audit and replay
state. Merging the two would force every consumer to learn a reserved workspace
identifier or infer that some records in a workspace log are not actually about
that workspace.

Keeping presence in the worker registry preserves the current invariant:
everything emitted by [[EventStore]] is a persisted workspace transition with a
real `workspace_id`. It also keeps the implementation aligned with the draft's
recoverability goal. Workers can reconnect and refresh their stored status
without fabricating an event history that cannot be replayed from workspace
state alone.

## Consequences

The protocol audit should no longer track worker presence as a missing REST or
JSON-RPC command. It is a deliberate v0.1 scope boundary. Future work may add a
host-level presence stream, but that must introduce a separate schema and
storage/query contract.

The public event vocabulary remains slightly wider than the emitted event
surface. That is acceptable while `specs.md` is still the draft Hadoof source and
this repository records ACP's narrower reference-host interpretation in ADRs and
the wiki.

## Alternatives

Emit presence into a reserved `workspace_host` log — rejected because it creates
a fake workspace and permanently pollutes workspace replay with host facts.

Require a `workspace_id` whenever status changes — rejected because it couples a
host-wide worker identity to the last workspace a client happened to mention and
breaks multi-workspace workers.

Add host events immediately — rejected for v0.1 because it creates a second event
scope, transport subscription shape, storage query, and replay policy before a
concrete integration requires one.

## Validation

This is a governance slice over existing behavior. The source remains aligned:
[[Event]] requires `workspace_id`, [[event-store]] appends and subscribes by
workspace, and [[worker-service]] persists worker status without an
[[EventStore]] dependency.

## Referenced by

[[ADR-0003-event-vocabulary-domain-boundaries]] · [[EventStream]] ·
[[Worker]] · [[Event]]
