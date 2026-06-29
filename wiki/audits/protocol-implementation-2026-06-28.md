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
revision follows the workspace aggregate resume-read slice and narrows the
remaining backed-command gap to lease lifecycle parity.

## Current Coverage

The object model remains fully represented in `src/protocol/schema`: Worker,
Workspace, WorkUnit, Lease, Artifact, Checkpoint, Review, Event, branded
identifiers, common vocabularies, session handshake shapes, and protocol errors.
Every stateful protocol concept has a domain service, and the application graph
composes those services through [[app-live]], [[Storage]], [[event-store]], and the
transport adapters.

The REST surface now covers the draft §12 command set plus backed reference-host
extensions for workspace create/update/archive, work progress publication,
review approve/reject/request-changes, and artifact update/delete. Artifact
create/update accepts external URIs for pull request, commit, CI report,
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
[[acp-http-api]] contract are aligned on those endpoints.

The JSON-RPC surface covers draft §13 plus the same backed extensions:
`workspace.create`, `workspace.update`, `workspace.archive`,
`work.publish_event`, `review.approve`, `review.reject`,
`review.request_changes`, `artifact.update`, and `artifact.delete`, with
artifact URI fields flowing through the shared schema. Work-centric resume read
commands, review-list reads, artifact-content reads, workspace work-index reads,
and workspace aggregate resume reads are also projected through JSON-RPC and the
CLI. `events.subscribe` maps to the SSE route. Runtime execution is available
through `POST /rpc` and `acp-jsonrpc-stdio`; WebSocket remains deferred by
[[ADR-0002-json-rpc-transport-framing]].

The event vocabulary boundary is settled for v0.1. Workspace archive and
artifact update/delete are backed by persisted domain mutations.
[[ADR-0005-worker-presence-scope]] classifies worker presence as host-scoped
registry state, not workspace event history.

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
scopes for backed work updates/events, lease release, artifact update/delete, and
review approve/reject/request-changes, and [[acp-router]] requires them when a
bearer session is presented. The local no-token `worker_system` fallback remains
unchanged for development mode.

Standalone protocol codecs and generated clients remain deferred by
[[ADR-0004-protocol-version-codecs-generated-client]]. They should re-enter the
queue only when an external SDK or public artifact policy exists. A
`src/infrastructure/platform-node` extraction also remains premature because
Node-specific wiring is still small and isolated in app entrypoints.

Host-level worker presence streams remain out of scope. ADR-0005 requires a new
schema and storage/query contract before any host-presence feed is implemented.

Public documentation drift is now covered. The README describes the implemented
REST/SSE, `POST /rpc`, stdio JSON-RPC, SQLite durability, local versus required
auth, scoped mutation permissions, expanded CLI, and WebSocket deferral.

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

The next backed-command gap is lease lifecycle parity. [[lease-service]] already
owns `renew` and `revoke`, and [[event.schema]] already includes
`lease.renewed` and `lease.revoked`, but the public transports expose only
request and release. That leaves long-running workers unable to extend an
advisory claim through ACP and leaves human or supervising systems without a
transport-level way to revoke a stale or unsafe lease before TTL expiry.

## Next Slice

Add lease lifecycle transport parity: `POST /v1/leases/{lease_id}/renew` and
`POST /v1/leases/{lease_id}/revoke`, JSON-RPC `lease.renew` and
`lease.revoke`, and CLI `lease renew`/`lease revoke`. Reuse
[[lease-service]] so conflict, TTL, and event semantics remain centralized.
Extend permission scopes explicitly rather than overloading `lease:release`;
renew and revoke are different operational powers. Generated clients,
host-level presence streams, WebSocket transport, Git-specific extensions, and
platform-node extraction remain deferred until a concrete consumer or duplicated
boundary appears.

## Referenced by

[[architecture/_MOC]] · [[protocol-implementation-2026-06-27]] ·
[[spec-canonicalization]]
