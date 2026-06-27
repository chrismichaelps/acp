---
type: audit
date: 2026-06-27
tags: [audit, protocol, coverage]
aliases: [protocol-coverage-2026-06-27]
---

# Protocol Coverage Audit — 2026-06-27

## Scope

This audit compares `specs.md` v0.1 against the current TypeScript
implementation and wiki mirror. The ignored local `specs.md` file remains
unchanged; this page records implementation coverage without mutating the source
draft.

## Covered

The core object model is represented in `src/protocol/schema`: Worker,
Workspace, WorkUnit, Lease, Artifact, Checkpoint, Review, Event, identifiers,
common enums, and protocol errors. Domain services exist for every core stateful
concept named by the spec, and the application graph composes them through
Effect Layers with swappable Storage.

The storage path now satisfies the v0.1 local-host need and the durability lane:
InMemory remains the default adapter, while SQLite provides durable keyed state
and append-only events through the same [[Storage]] seam. Hot event reads are
scoped by workspace and sequence, which keeps replay bounded for large
agent-memory and handoff histories.

The REST transport covers the v0.1 command surface: session initialize,
workspace list, work create/claim/update/progress event, lease request/release,
artifact create, checkpoint create, review request/action, and event subscription
over SSE. Artifact deletion is exposed as `DELETE /v1/artifacts/{artifact_id}`
and emits `artifact.deleted` through the domain service. `session.initialize`
accepts the draft §9 handshake shape
(`protocol_version`, worker descriptor, and client capability flags) as well as
the implementation's earlier full-worker payload. Mandatory-auth mode exists
behind `ACP_REQUIRE_AUTH`, with `session.initialize` left open as the bootstrap
route.

JSON-RPC coverage is current for spec §13 plus the REST progress-publication
parity aliases `work.publish_event`, `review.approve`, `review.reject`, and
`review.request_changes`. Method normalization, response folding, batch handling,
notifications, `POST /rpc`, and stdio Content-Length framing are implemented.
WebSocket remains explicitly deferred by
[[ADR-0002-json-rpc-transport-framing]] because stdio satisfies the non-HTTP
JSON-RPC option for v0.1.

The local implementation standards are substantially covered: TypeScript,
Effect Schema, Effect services/Layers, typed Config, tagged domain errors,
immutable Effect structures where service boundaries need them, linting,
formatting, and test gates are in place. Node v24 is required by the SQLite
adapter through `node:sqlite`.

## Gaps

The event vocabulary is broader than the service behavior. Worker events are not
emitted because workers are currently host-scoped registry records, not
workspace-scoped event actors. `workspace.archived` has no corresponding
workspace lifecycle field yet. Artifact update/delete events are declared in the
spec vocabulary; delete is now transport-visible through REST and JSON-RPC, while
update remains absent because artifacts are immutable after creation in the
current domain model.

Capability negotiation is intentionally permissive. The host returns the spec §9
response with `protocol_version`, host descriptor, and host capabilities. On
request, it accepts either the draft capability object or a full internal
[[Worker]] record; the router normalizes both into the stored worker registry and
keeps scoped `permissions` as the bearer-session extension from spec §8.

Naming remains historically mixed in `specs.md`: the source draft still says
Hadoof and uses `hadoof://` in examples, while the implementation and ADR-0001
canonically use ACP and `acp://`. The wiki records this, but the draft itself is
ignored and has not been rewritten.

## Next Slice

Close the remaining event-surface mismatch. Worker presence events,
`workspace.archived`, and artifact update events are named by the draft
vocabulary, but they need domain state decisions before becoming public
transport routes.

## Referenced by

[[architecture/_MOC]] · [[Transport]] · [[EventStream]]
