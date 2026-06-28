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
refresh, and CLI parser dispatch-table slices. It compares the current ACP
reference host against `@root/specs.md` through [[spec-canonicalization]], then
chooses the next backed implementation gap.

## Current Coverage

The object model remains fully represented in `src/protocol/schema`: Worker,
Workspace, WorkUnit, Lease, Artifact, Checkpoint, Review, Event, branded
identifiers, common vocabularies, session handshake shapes, and protocol errors.
Every stateful protocol concept has a domain service, and the application graph
composes those services through [[app-live]], [[Storage]], [[event-store]], and the
transport adapters.

The REST surface now covers the draft §12 command set plus backed reference-host
extensions for workspace create/update/archive, work progress publication,
review approve/reject/request-changes, and artifact update/delete. The router and
the declarative [[acp-http-api]] contract are aligned on those endpoints.

The JSON-RPC surface covers draft §13 plus the same backed extensions:
`workspace.create`, `workspace.update`, `workspace.archive`,
`work.publish_event`, `review.approve`, `review.reject`,
`review.request_changes`, `artifact.update`, and `artifact.delete`.
`events.subscribe` maps to the SSE route. Runtime execution is available through
`POST /rpc` and `acp-jsonrpc-stdio`; WebSocket remains deferred by
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
than another branch in a long dispatch chain.

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

The next integration-facing gap is artifact references. [[artifact-service]]
currently supports host-stored inline content and always mints
`acp://artifacts/{id}`. That is correct for patches, logs, and markdown captured
by the local host, but it does not let a worker register an external artifact URI
for a pull request, commit, CI report, screenshot, or cloud object even though the
[[Artifact]] record itself already has a required `uri`. External references are
the smallest useful bridge toward the v0.2 GitHub PR artifact and adapter
roadmap without introducing GitHub-specific schemas yet.

## Next Slice

Add external artifact URI support to `CreateArtifactPayload` and
`UpdateArtifactPayload`, then project it through [[artifact-service]], REST,
JSON-RPC, and [[cli-commands]]. Preserve host-stored `acp://artifacts/{id}` as
the default when content is supplied without an explicit URI, keep content size
limits on host-stored content only, and reject payloads that provide neither
content nor an external URI. Treat generated clients, host-level presence
streams, WebSocket transport, Git-specific extensions, and platform-node
extraction as deferred until a concrete consumer or duplicated boundary appears.

## Referenced by

[[architecture/_MOC]] · [[protocol-implementation-2026-06-27]] ·
[[spec-canonicalization]]
