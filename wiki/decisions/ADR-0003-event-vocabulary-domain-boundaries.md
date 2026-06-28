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
`artifact.deleted` through `DELETE /v1/artifacts/{artifact_id}` and JSON-RPC
`artifact.delete`.

The remaining vocabulary is not merely missing transport wiring. Worker presence
is host-scoped while the current [[Event]] schema is workspace-scoped.
`workspace.archived` has no lifecycle field or archive marker in
[[workspace.schema]]. `artifact.updated` has no mutation command; artifacts are
currently immutable after creation except for removal.

## Decision

ACP v0.1 exposes and emits only event types backed by a persisted domain state
transition. Event names that do not yet have a domain representation remain part
of the draft vocabulary but are not public routes, JSON-RPC methods, or synthetic
events in the reference host.

Worker presence events are deferred until ACP has a host-level or global event
scope distinct from workspace logs. The implementation will not invent a
reserved pseudo-workspace for `worker.online`, `worker.offline`, or
`worker.status_changed`.

Workspace archive is deferred until the workspace model gains an explicit
lifecycle representation. The implementation will not model archive as
`storage.remove`, because that would break event replay and orphan workspace
history.

Artifact update is deferred until artifacts have explicit mutation semantics.
The implementation will not emit `artifact.updated` for metadata replacement or
content overwrite until the domain defines what may change, what remains
immutable, and how existing artifact URIs behave.

## Rationale

Events are audit records, not speculative notifications. Emitting a named event
without a persisted state transition makes replay misleading: a subscriber sees
activity that cannot be reconstructed from domain state. Keeping the event
surface tied to service-owned mutations preserves the append-only contract and
keeps [[EventStream]] consumers honest.

Worker presence needs a different scope. A worker registers at
`session.initialize` before a workspace is necessarily selected, and one worker
may coordinate across multiple workspaces. Forcing that activity into an
arbitrary workspace stream would leak host concerns into workspace history.

Workspace archive needs a real lifecycle field. Removing the workspace record is
not archive; it is deletion, and it damages the log boundary that makes
workspace-scoped replay useful.

Artifact update needs a product decision about mutability. Current artifacts are
durable outputs with stable `acp://artifacts/{id}` URIs; allowing mutation
without defining content/version behavior would weaken their evidentiary role.

## Consequences

The event vocabulary audit can treat these names as domain-design work rather
than transport gaps. Transport parity should continue only for operations that
already exist in domain services.

A future worker-presence slice should first decide whether ACP needs a host
event stream, a workspace-membership event model, or both. A future workspace
archive slice should add explicit schema and service semantics before transport.
A future artifact update slice should decide whether updates mutate the existing
artifact, create a new version, or produce a replacement artifact linked through
metadata.

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
registry has no [[EventStore]] dependency, and artifact removal is already the
only non-create artifact mutation exposed by the domain.

## Referenced by

[[Transport]] · [[EventStream]] · [[protocol-coverage-2026-06-27]] ·
[[architecture/_MOC]]
