---
type: audit
date: 2026-06-28
tags: [audit, protocol, implementation]
aliases: [protocol-implementation-2026-06-28, protocol-audit-refresh-2026-06-28]
---

# Protocol Implementation Audit — 2026-06-28

## Scope

This audit refreshes [[protocol-implementation-2026-06-27]] after the workspace
archive lifecycle, JSON-RPC command-map split, artifact update lifecycle, and
[[ADR-0005-worker-presence-scope]] slices. It compares the current ACP reference
host against `@root/specs.md` through [[spec-canonicalization]], then chooses the
next backed implementation gap.

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
SQLite adapter, auth mode, CLI, and stdio bridge.

## Remaining Gaps

The largest concrete gap was local CLI parity. [[cli-commands]] now exposes the
backed workspace create/update/archive, artifact update/delete, and review
approve/reject/request-changes routes in addition to the older command set. The
[[cli-client]] supports `DELETE`, so artifact removal is available from the local
shell path.

The CLI gap was integration-facing rather than domain-facing. Closing it did not
require new protocol state, storage shape, or event semantics, only an expanded
argv-to-route projection, usage text, and parser/client tests.

The next concrete gap is permission-scope parity. The command surface now
includes backed artifact mutation and review action routes, but [[common]] still
defines only the original create/read/write-era session scopes:
`workspace:read`, `workspace:write`, `work:create`, `work:claim`,
`lease:create`, `artifact:create`, `checkpoint:create`, and `review:create`.
Routes such as artifact update/delete and review approve/reject/request-changes
currently resolve an actor through [[acp-router]] `authorize()` without requiring
a matching action scope. The spec's security section calls out explicit
permission for destructive actions, so the reference host should make those
mutations scope-addressable before adding more integrations.

Standalone protocol codecs and generated clients remain deferred by
[[ADR-0004-protocol-version-codecs-generated-client]]. They should re-enter the
queue only when an external SDK or public artifact policy exists. A
`src/infrastructure/platform-node` extraction also remains premature because
Node-specific wiring is still small and isolated in app entrypoints.

Host-level worker presence streams remain out of scope. ADR-0005 requires a new
schema and storage/query contract before any host-presence feed is implemented.

## Next Slice

Implement permission-scope parity for the backed mutation surface. Extend
[[common]] `Permission` with action scopes for work updates/events, lease
release, artifact update/delete, and review actions; update session/router wiki
mirrors before code; require those scopes in [[acp-router]] while preserving the
local no-token `worker_system` fallback; and add route tests that prove scoped
sessions can perform the mutations while sessions missing the new scopes receive
`401 unauthorized`.

## Referenced by

[[architecture/_MOC]] · [[protocol-implementation-2026-06-27]] ·
[[spec-canonicalization]]
