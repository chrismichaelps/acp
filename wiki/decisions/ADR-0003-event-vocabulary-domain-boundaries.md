---
type: adr
status: ACCEPTED
date: 2026-06-27
tags: [adr, events, domain]
aliases: [ADR-0003, ADR-0003-event-vocabulary-domain-boundaries]
---

# ADR-0003 — Event Vocabulary Domain Boundaries

## Status

ACCEPTED — 2026-06-27.

## Context

Spec §11 names a broad event vocabulary: worker presence, workspace lifecycle,
work state, lease state, artifact lifecycle, checkpoints, and review decisions.
The implementation already has an append-only [[Event]] model keyed by
`workspace_id`, an [[event-store]] that appends and streams workspace-scoped
records, and service-owned event emission for persisted state changes.

Most command-backed events now have a domain owner. [[work-unit-service]],
[[lease-service]], [[artifact-service]], [[checkpoint-service]],
[[review-service]], and [[workspace-service]] emit their events after state is
persisted. Transport routes expose the backed command surface, including
artifact update/delete and workspace archive.

The remaining vocabulary was not merely missing transport wiring. Worker
presence is host-scoped while the current [[Event]] schema is workspace-scoped.
Workspace archive and artifact update now have explicit domain semantics.

## Decision

ACP v0.1 exposes and emits only event types backed by a persisted domain state
transition. Event names that do not yet have a domain representation remain part
of the draft vocabulary but are not public routes, JSON-RPC methods, or synthetic
events in the reference host.

Worker presence events remain outside workspace logs. The implementation will
not invent a reserved pseudo-workspace for `worker.online`, `worker.offline`, or
`worker.status_changed`; [[ADR-0005-worker-presence-scope]] defines the v0.1
presence rule.

Workspace archive is backed by an explicit `WorkspaceState` lifecycle field. The
implementation does not model archive as `storage.remove`, because that would
break event replay and orphan workspace history.

Artifact update is backed by explicit mutation semantics. Existing artifact
identity and URI remain stable while mutable metadata and optional content are
replaced.

## Rationale

Events are audit records, not speculative notifications. Emitting a named event
without a persisted state transition makes replay misleading: a subscriber sees
activity that cannot be reconstructed from domain state. Keeping the event
surface tied to service-owned mutations preserves the append-only contract and
keeps [[EventStream]] consumers honest.

Worker presence needs a different scope; [[ADR-0005-worker-presence-scope]]
accepts the v0.1 rule that presence remains host-scoped registry state rather
than workspace event history. A worker registers at `session.initialize` before a
workspace is necessarily selected, and one worker may coordinate across multiple
workspaces. Forcing that activity into an arbitrary workspace stream would leak
host concerns into workspace history.

Workspace archive needs a real lifecycle field. Removing the workspace record is
not archive; it is deletion, and it damages the log boundary that makes
workspace-scoped replay useful. That lifecycle now exists.

Artifact update needs a product decision about mutability. Current artifacts are
durable outputs with stable `acp://artifacts/{id}` URIs; allowing mutation
without defining content/version behavior would weaken their evidentiary role.
That mutability rule now exists.

## Consequences

The event vocabulary audit can treat unmatched names as domain-design work rather
than transport gaps. Transport parity should continue only for operations that
already exist in domain services.

Worker presence has now been resolved for v0.1 by
[[ADR-0005-worker-presence-scope]]. A future host-presence stream should add a
new schema and storage/query contract instead of reusing workspace logs.

## Alternatives

Emit worker presence into a reserved `workspace_host` log — rejected: it creates
a fake workspace and makes consumers special-case a value the protocol does not
define.

Implement workspace archive as physical removal — rejected: it is not archive
and breaks replay of a workspace's history.

Treat artifact update as delete plus create — rejected: the draft names
`artifact.updated`, and collapsing it into two separate lifecycle events would
make clients infer semantics that the domain has not promised.

## Validation

This is a governance decision over existing behavior. It is validated by the
current service boundaries: workspace events append to workspace logs, worker
registry has no [[EventStore]] dependency, and artifact update/delete are backed
by [[artifact-service]] mutations.

## Referenced by

[[Transport]] · [[EventStream]] · [[protocol-coverage-2026-06-27]] ·
[[ADR-0005-worker-presence-scope]] · [[architecture/_MOC]]
