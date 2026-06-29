---
type: audit
date: 2026-06-28
tags: [audit, protocol, implementation]
aliases: [protocol-implementation-2026-06-28, protocol-audit-refresh-2026-06-28]
---

# Protocol Implementation Audit — 2026-06-28

## Scope

This audit refreshes [[protocol-implementation-2026-06-27]] after the workspace
archive lifecycle, JSON-RPC command-map split, artifact update lifecycle,
[[ADR-0005-worker-presence-scope]], CLI parity, permission scope parity, README
refresh, CLI parser dispatch-table, external artifact reference, work resume
query, Effect observability logging, and second resume-read slices. It compares
the current ACP reference host against `@root/specs.md` through
[[spec-canonicalization]], then chooses the next backed implementation gap. This
revision follows the README lease refresh and WebSocket transport slice, closing
the stale WebSocket deferral, host-scoped worker presence reads, WebSocket
event subscription, and the next replay-read integration gap.

## Current Coverage

The object model remains fully represented in `src/protocol/schema`: Worker,
Workspace, WorkUnit, Lease, Artifact, Checkpoint, Review, Event, branded
identifiers, common vocabularies, session handshake shapes, and protocol errors.
Every stateful protocol concept has a domain service, and the application graph
composes those services through [[app-live]], [[Storage]], [[event-store]], and the
transport adapters.

The REST surface now covers the draft §12 command set plus backed reference-host
extensions for workspace create/update/archive, work progress publication,
review approve/reject/request-changes, artifact update/delete, and lease
renew/revoke. Artifact create/update accepts external URIs for pull request,
commit, CI report,
screenshot, or cloud-object references while preserving host-stored
`acp://artifacts/{id}` content as the default. Work-centric resume reads now
cover `GET /v1/work/{work_id}`, checkpoint lists, latest checkpoint, artifact
metadata lists, review lists, and host-stored artifact content. Workspace
discovery now includes `GET /v1/workspaces/{workspace_id}/work`, JSON-RPC
`work.list_for_workspace`, and CLI `work list --workspace <id>`, so a resuming
agent can discover current WorkUnit ids before using work-scoped reads.
Workspace-level aggregate reads now expose checkpoints, artifact metadata, and
reviews for dashboards or supervising agents that need resumability evidence
without iterating every WorkUnit id. The router and the declarative
[[acp-http-api]] contract are aligned on those endpoints. Workspace event replay
now exposes the append-only timeline through `GET /v1/events`, JSON-RPC
`events.list`, and CLI `events list`, using the existing `(workspace_id, seq)`
storage cursor.

The JSON-RPC surface covers draft §13 plus the same backed extensions:
`workspace.create`, `workspace.update`, `workspace.archive`,
`work.publish_event`, `review.approve`, `review.reject`,
`review.request_changes`, `artifact.update`, `artifact.delete`, `lease.renew`,
and `lease.revoke`, with artifact URI fields flowing through the shared schema.
Work-centric resume read commands, review-list reads, artifact-content reads,
workspace work-index reads, and workspace aggregate resume reads are also
projected through JSON-RPC and the CLI. `events.subscribe` maps to the live
event path: SSE for HTTP clients and `events.event` notifications for WebSocket
JSON-RPC clients. Runtime execution is available through `POST /rpc` and
`acp-jsonrpc-stdio`. `GET /rpc` now upgrades to a WebSocket and frames the same
JSON-RPC request/response surface over text messages, reusing the in-process
router through [[rpc-socket]] and [[rpc-endpoint]].

The event vocabulary boundary is settled for v0.1. Workspace archive and
artifact update/delete are backed by persisted domain mutations.
[[ADR-0005-worker-presence-scope]] classifies worker presence as host-scoped
registry state, not workspace event history. Current worker records are now
readable through REST, JSON-RPC, and the CLI with a dedicated `worker:read`
scope, preserving that boundary while giving clients a supported presence
inspection path.

Implementation standards are covered: Node 24 is pinned, package scripts cover
lint, format check, typecheck, file-size, and tests, CI runs the same gate on
pull requests and `main`, and the README describes the current local server,
SQLite adapter, auth mode, CLI, and stdio bridge. The CLI parser is now
table-driven, so extending command coverage is an additive handler entry rather
than another branch in a long dispatch chain. Server logging is now configured
through Effect's structured logger with `ACP_LOG_LEVEL`, stable service/component
annotations, and low-cardinality sweeper health logs; CLI and stdio stdout remain
uncontaminated protocol/user output.

## Remaining Gaps

The largest concrete gap was local CLI parity. [[cli-commands]] now exposes the
backed workspace create/update/archive, artifact update/delete, and review
approve/reject/request-changes routes in addition to the older command set. The
[[cli-client]] supports `DELETE`, so artifact removal is available from the local
shell path.

The CLI gap was integration-facing rather than domain-facing. Closing it did not
require new protocol state, storage shape, or event semantics, only an expanded
argv-to-route projection, usage text, and parser/client tests.

Permission-scope parity is now covered. [[common]] includes dedicated action
scopes for backed work updates/events, lease renew/release/revoke, artifact
update/delete, and review approve/reject/request-changes, and [[acp-router]]
requires them when a bearer session is presented. The local no-token
`worker_system` fallback remains unchanged for development mode.

Standalone protocol codecs and generated clients remain deferred by
[[ADR-0004-protocol-version-codecs-generated-client]]. They should re-enter the
queue only when an external SDK or public artifact policy exists. A
`src/infrastructure/platform-node` extraction also remains premature because
Node-specific wiring is still small and isolated in app entrypoints.

Host-level worker presence streams remain out of scope for the current code.
ADR-0005 requires a new schema and storage/query contract before any
host-presence feed is implemented. Presence reads are covered by
[[worker-routes]], `worker.list`, `worker.get`, and the local CLI, so a live
presence feed is no longer needed merely to inspect current status.

Public documentation drift is covered again. The README describes the
implemented REST/SSE, `POST /rpc`, stdio JSON-RPC, `GET /rpc` WebSocket
request/response framing and event notifications, SQLite durability, local
versus required auth, scoped mutation permissions, worker registry reads,
expanded CLI, and lease renew/revoke.

SQLite query shape is not the next bottleneck. [[sqlite-store]] uses `WITHOUT
ROWID` composite primary-key layouts for keyed collections and per-workspace
event logs, prepares hot statements once per Layer, and has query-plan coverage
for collection scans and event tail replay. That is the right baseline for
thousands of coordination records or agent-memory artifacts before adding
entity-specific repositories.

External artifact references are now covered. [[artifact-service]] supports both
host-stored inline content and explicit external `uri` references, so workers can
record pull requests, commits, CI reports, screenshots, and cloud objects without
copying large output into ACP. Empty artifact creates are rejected because they
do not provide recoverable evidence.

Work resume query endpoints are now covered for a known work id:
[[work-unit-service]] current state, [[checkpoint-service]] history/latest,
[[artifact-service]] metadata/content, and [[review-service]] review gates are
available through REST, JSON-RPC, and the CLI.

Workspace work discovery is now covered. A worker can list workspaces, list the
WorkUnits inside one workspace, and then resume a chosen WorkUnit through the
work-scoped reads. Workspace aggregate reads are now covered for associated
evidence and gates: checkpoints, artifact metadata, and reviews. Supervising
agents no longer need to iterate every WorkUnit id to reconstruct workspace
resumability state.

Lease lifecycle parity is now covered. [[lease-service]] `renew` and `revoke`
are projected through REST, JSON-RPC, and the CLI with dedicated `lease:renew`
and `lease:revoke` scopes. Long-running workers can extend advisory claims
through ACP, and supervising systems can revoke stale or unsafe leases before TTL
expiry.

WebSocket request/response transport is now covered. [[rpc-socket]] mounts
`GET /rpc` beside `POST /rpc`, authenticates the socket with the handshake bearer
header or `?token=` fallback, and processes each text frame as a JSON-RPC single
request or batch. WebSocket `events.subscribe` is now also covered for persisted
workspace events: a single subscribe frame acknowledges the subscription and
later events arrive as `events.event` JSON-RPC notifications on the same socket.
HTTP JSON-RPC continues to reject stream commands, and SSE remains the HTTP live
channel.

Event history replay is now public. [[event-store]] `readAfter` is projected
through REST, JSON-RPC, and the CLI with `event:read`, so recovering agents can
replay persisted workspace history before opening SSE or WebSocket live
subscriptions.

Review cancellation remains a bounded domain/event vocabulary gap. [[Review]]
already includes the `cancelled` state, but [[event.schema]] has no
`review.cancelled` event type and [[review-service]] deliberately maps no cancel
operation. This is smaller and more concrete than generated clients or
platform-node extraction: it is a protocol object state that lacks a faithful
event and transport projection.

Host-scoped worker presence reads are now covered. [[worker-routes]] exposes the
current registry through `GET /v1/workers` and `GET /v1/workers/{worker_id}`;
[[json-rpc-worker-commands]] maps `worker.list` and `worker.get` to those routes;
and [[cli-commands]] exposes the same inspection path locally. The slice keeps
presence out of workspace [[Event]] logs and avoids a premature host-presence
stream.

## Next Slice

Add review cancellation as a backed domain lifecycle. The slice should add
`review.cancelled` to [[event.schema]], teach [[review-service]] to cancel a
requested review without fabricating another outcome, and project that operation
through REST, JSON-RPC, and the CLI with a dedicated scope. Generated clients,
Git-specific extensions, host-presence streams, and platform-node extraction
remain deferred until a concrete consumer or duplicated boundary appears.

## Referenced by

[[architecture/_MOC]] · [[protocol-implementation-2026-06-27]] ·
[[spec-canonicalization]]
