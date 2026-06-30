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
query, Effect observability logging, second resume-read slices, review
cancellation, workspace [[Memory]], request lifecycle logging, and the native
[[acp-rpc-contract]] foundation. It compares the current ACP reference host
against `@root/specs.md` through [[spec-canonicalization]], then chooses the next
backed implementation gap. This revision follows the README lease refresh and
WebSocket transport slice, closing the stale WebSocket deferral, host-scoped
worker presence reads, WebSocket event subscription, replay-read integration gap,
and review cancellation lifecycle.

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
renew/revoke. Review cancellation is now a first-class withdrawal lifecycle:
`review.cancelled` is a distinct event, not an alias for `review.rejected`, and
the associated WorkUnit returns from `needs_review` to `running`. Artifact
create/update accepts external URIs for pull request,
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
`review.request_changes`, `review.cancel`, `artifact.update`,
`artifact.delete`, `lease.renew`, and `lease.revoke`, with artifact URI fields
flowing through the shared schema.
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
queue only when an external SDK or public artifact policy exists.

The first `src/infrastructure/platform-node` boundary is now covered.
[[node-http-server]] owns Node HTTP socket construction, [[server-main]] provides
that Layer to [[http-app]], and real-socket tests use the same factory with
`port: 0`. Process IO is now covered too: [[node-process-io]] owns argv,
stdin, and stdout access for [[cli-main]] and [[stdio-main]]. The remaining Node
built-ins are either inside `src/infrastructure/platform-node`, the SQLite
storage adapter, or tests.

Host-level worker presence streams remain out of scope for the current code.
ADR-0005 requires a new schema and storage/query contract before any
host-presence feed is implemented. Presence reads are covered by
[[worker-routes]], `worker.list`, `worker.get`, and the local CLI, so a live
presence feed is no longer needed merely to inspect current status.

Public documentation drift is covered again. The README describes the
implemented REST/SSE, `POST /rpc`, stdio JSON-RPC, `GET /rpc` WebSocket
request/response framing and event notifications, SQLite durability, local
versus required auth, scoped mutation permissions, worker registry reads,
expanded CLI, lease renew/revoke, review cancellation, tracked `specs.md`, and
the current platform-node adapter boundary.

The draft spec is now tracked and canonicalized. Normative sections use Agent
Coordination Protocol (ACP), `ACP_` configuration examples, `acp://` artifact
examples, illustrative `example.com` repository URIs, and stable section numbers
through 25. Hadoof appears only in the historical supersession note.

SQLite query shape is not the next bottleneck. [[sqlite-store]] uses `WITHOUT
ROWID` composite primary-key layouts for keyed collections and per-workspace
event logs, prepares hot statements once per Layer, and has query-plan coverage
for collection scans and event tail replay. That is the right baseline for
thousands of coordination records or agent-memory artifacts before adding
entity-specific repositories.

Native RPC now has a stable code anchor and multiple direct handler verticals.
[[acp-rpc-contract]] defines an `@effect/rpc` `AcpRpcGroup` for the current
non-streaming operation set and proves the closed tag surface with a registry
test. [[acp-rpc-handlers]] implements `session.initialize`, worker reads,
workspace reads/mutations, work creation/discovery/current-state reads, work
claiming, work state transitions, work event publication, and lease
request/renew/release/revoke through direct service calls. The split
[[acp-rpc-artifact-handlers]] layer covers artifact create/update/delete,
content, work-list, and workspace-list operations while keeping the aggregate
handler file below the source-size guard. [[acp-rpc-checkpoint-handlers]] covers
checkpoint create/list/latest operations and split the focused RPC tests so the
test suite also stays below the source-size guard. [[rpc-auth]] preserves
bearer-session scope behavior and [[rpc-error]] maps domain failures into ACP
`ProtocolError` envelopes. The implementation still does not replace
`POST /rpc`/`GET /rpc`, and does not delete the JSON-RPC command map; this keeps
the migration reversible while the native layer grows.

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

Review cancellation is now covered in both implementation and the tracked draft
spec. [[event.schema]] includes `review.cancelled`, [[review-service]] cancels
only requested reviews without fabricating a reviewer outcome, [[acp-router]]
exposes `POST /v1/reviews/{review_id}/cancel` behind `review:cancel`, JSON-RPC
maps `review.cancel`, and [[cli-commands]] maps `review cancel <review_id>`.
`@root/specs.md` now names the `needs_review -> running` withdrawal path and the
same REST, JSON-RPC, event, and CLI surface.

Permission vocabulary precision is now covered. Section 8 of `@root/specs.md`
names the closed v0.1 scope set from [[common]], including worker reads,
workspace mutation, event replay, work updates and progress events, lease
renew/release/revoke, artifact mutation, checkpoint creation, and review
approve/reject/request_changes/cancel. The same section now uses ACP bearer
token naming instead of the stale pre-canonicalization placeholder.

Late-document roadmap status is now covered. The Reference MVP Roadmap places
JSON-RPC over HTTP POST, stdio, and WebSocket plus the closed bearer-session
permission model in v0.1, leaving Git worktree integration, GitHub PR
artifacts, agent adapters, desktop UI, cloud sync, organization workspaces,
SDKs, and public adapter registry as future milestones. The JSON-RPC open
question now asks about default recommendation rather than basic existence.

Answered Open Questions are now cleaned up. `@root/specs.md` records advisory
leases and dual-mode artifact storage as resolved v0.1 decisions, while memory
scope, Git-specific extensions, signed approvals, JSON-RPC default
recommendation, and offline CRDT sync remain genuinely open.

The workspace memory foundation is now covered. `@root/specs.md` defines
[[Memory]] as a bounded v0.1 protocol feature with `memory:create` and
`memory:read` scopes, `supports_memory` capability negotiation, a Memory object,
`memory.created`, REST/JSON-RPC surfaces, and a storage shape built around
`(workspace_id, seq)` cursor reads plus key/work indexes. The wiki now has a
[[Memory]] domain page and [[workspace-memory-records]] reference note for the
SQL/query plan. The feature is intentionally append-oriented and small-record
focused; large outputs remain [[Artifact]] records.

The workspace memory core is now covered below the transport layer. [[common]]
and [[memory.schema]] define Memory ids, kinds, payloads, query shapes, and
`memory.created`; [[Storage]] has append/read Memory operations; [[sqlite-store]]
persists Memory through a dedicated `WITHOUT ROWID` table with prepared
cursor/key/work statements; [[in-memory-store]] preserves the same per-workspace
sequence semantics; and [[memory-service]] creates records, emits
`memory.created`, and exposes cursor reads. Focused tests and the broad
non-socket suite cover thousands-record cursor replay and query-plan behavior.

The next gap is transport projection. REST, JSON-RPC, and CLI should expose
Memory creation and reads behind `memory:create` and `memory:read`. Because
[[acp-router]] and [[acp-http-api]] are near the source-size ceiling, this slice
should first split memory-specific HTTP route/API definitions into dedicated
files, following the existing event/worker/resume route pattern, then add
JSON-RPC and CLI commands as thin projections over the service.

Host-scoped worker presence reads are now covered. [[worker-routes]] exposes the
current registry through `GET /v1/workers` and `GET /v1/workers/{worker_id}`;
[[json-rpc-worker-commands]] maps `worker.list` and `worker.get` to those routes;
and [[cli-commands]] exposes the same inspection path locally. The slice keeps
presence out of workspace [[Event]] logs and avoids a premature host-presence
stream.

## Next Slice

Workspace Memory now has full transport parity: [[memory-routes]]
(`POST /v1/memory`, `GET /v1/memory`) behind `memory:create`/`memory:read`,
the [[acp-http-api-memory]] contract, [[json-rpc-memory-commands]]
(`memory.create`/`memory.list`), and `memory create`/`memory list` CLI commands —
each a schema decode → [[memory-service]] → schema encode boundary. No
backed-command coverage gap remains across REST, JSON-RPC, and the CLI.

The open architectural decision is now resolved by
[[ADR-0007-effect-rpc-adoption]]. ACP will adopt `@effect/rpc` as the native
first-party RPC surface and retire the hand-mapped JSON-RPC command layer once
the replacement is live. The ADR deliberately drops JSON-RPC 2.0 wire
compatibility because no MCP/polyglot client exists; the reference clients are
Effect/TypeScript and benefit more from a typed `RpcGroup`, direct domain
handlers, typed errors, streaming, and generated clients than from preserving a
paper wire format.

The work/workspace native RPC handler vertical is now covered. Direct handlers
for `workspace.create`, `workspace.update`, `workspace.archive`, `work.create`,
`work.list_for_workspace`, `work.get`, `work.claim`, `work.update_state`, and
`work.publish_event` reuse [[rpc-auth]], [[rpc-error]], [[id-clock]], domain
services, and direct `accessHandler` tests without going through HTTP,
WebSocket, stdio, or JSON-RPC adapters.

The lease native RPC handler vertical is now covered. Direct handlers for
`lease.request`, `lease.renew`, `lease.release`, and `lease.revoke` reuse
[[lease-service]] for TTL/default-config, active-resource conflict detection,
state transitions, and lifecycle events. They authorize the dedicated lease
scopes, mint ids/timestamps through [[id-clock]], map domain failures through
[[rpc-error]], and preserve `lease.release` as a void success matching the
existing HTTP `204` command shape.

The artifact native RPC handler vertical is now covered. Direct handlers for
`artifact.create`, `artifact.update`, `artifact.delete`, `artifact.content`,
`artifact.list_for_work`, and `artifact.list_for_workspace` reuse
[[artifact-service]] for content-size validation, host-stored content, external
URI references, event emission, deletion, and metadata/content reads. They
authorize dedicated artifact mutation scopes or `workspace:read` for resume
queries, mint ids/timestamps through [[id-clock]], map missing artifacts/content
through [[rpc-error]], and prove host-stored plus external artifact behavior with
direct `accessHandler` tests.

The checkpoint native RPC handler vertical is now covered. Direct handlers for
`checkpoint.create`, `checkpoint.list_for_work`, `checkpoint.latest_for_work`,
and `checkpoint.list_for_workspace` reuse [[checkpoint-service]] for append-only
persistence, newest-first ordering, latest selection, and `checkpoint.created`
event emission. They authorize `checkpoint:create` for creation and
`workspace:read` for resume reads, mint create ids/timestamps through
[[id-clock]], map missing latest checkpoints through [[rpc-error]], and prove
create/list/latest/workspace behavior with direct `accessHandler` tests.

The review native RPC handler vertical is now covered. Direct handlers for
`review.request`, `review.approve`, `review.reject`, `review.request_changes`,
`review.cancel`, `review.list_for_work`, and `review.list_for_workspace` reuse
[[review-service]] for WorkUnit state coupling, requirement validation,
cancellation semantics, workspace resolution, and review event emission. They
authorize the dedicated review scopes plus `workspace:read` for list reads, mint
request ids/timestamps through [[id-clock]], and map domain failures through
[[rpc-error]].

The memory and event native RPC handler vertical is now covered. Direct handlers
for `memory.create`, `memory.list`, and `events.list` in
[[acp-rpc-memory-event-handlers]] reuse [[memory-service]] for seq assignment and
`memory.created` emission and the [[event-store]] for `readAfter` replay. They
authorize `memory:create`, `memory:read`, and `event:read`, forward the native
`ReadMemoryQuery` payload without URL re-decode, mint memory ids/timestamps
through [[id-clock]], and prove recall, replay, and scope-denial with direct
`accessHandler` tests.

With this vertical merged, **every [[acp-rpc-contract]] request now has a backing
handler** — the native handler phase of [[ADR-0007-effect-rpc-adoption]] is
complete.

The native RPC HTTP transport is now mounted on the host. [[acp-rpc-server]]
exposes both a host-shared `AcpRpcHandlersLayer` and a dependency-complete
`AcpRpcHandlersLive`; [[native-rpc-route]] mounts the shared handler layer at
`/rpc/native` with `RpcServer.layerHttpRouter`, JSON serialization, and HTTP
protocol framing; and [[http-app]] serves `AcpHttpRoutesLive` through
`HttpLayerRouter.serve` so REST, `POST /rpc`, `GET /rpc`, native RPC, and the
sweeper all receive one memoized `AppLive ⊕ IdClockLive`. The live regression
drives `makeAcpRpcClient` over an ephemeral TCP socket, creates a workspace
through native RPC, and reads it back through REST using the same bearer session,
which proves route mounting, client transport wiring, and shared host state.

Native RPC auth middleware is now covered as a transport policy seam.
[[acp-rpc-contract]] annotates secured operations with the same closed
permission scopes already enforced by handlers, [[rpc-auth-middleware]] reads
that metadata through `@effect/rpc` middleware and delegates bearer/session
resolution to [[rpc-auth]], and [[acp-rpc-server]] merges the middleware into the
handler layer used by [[native-rpc-route]]. Contract tests pin representative
scope metadata and the native HTTP route still proves insufficient scopes are
rejected over the generated client path. Handler-local `authorizeRpc` calls
remain intentionally in place because direct `accessHandler` tests do not
execute `RpcServer` middleware yet.

Native `events.subscribe` is now covered on the first-party Effect RPC surface.
[[acp-rpc-contract]] declares it with `stream: true`, `Event` chunks, and
`ProtocolError` stream failures; [[acp-rpc-memory-event-handlers]] authorizes
`event:read` and returns the scoped [[event-store]] workspace subscription; and
[[native-rpc-route]] plus [[acp-rpc-client]] now use NDJSON framing so streaming
HTTP can deliver chunks without breaking unary calls. The live route regression
subscribes through the generated client, publishes a work event, and observes
the same event id from the stream.

The native RPC actor bridge is now started. [[rpc-auth]] owns `AcpRpcActor` and
`rpcActor`; handlers can consume the middleware-provided actor when running
through [[rpc-auth-middleware]], while direct `accessHandler` tests still fall
back to bearer-header authorization. [[acp-rpc-memory-event-handlers]] is the
first migrated vertical: memory creation attributes through `rpcActor`, memory
and event reads check scopes through the same bridge, and focused tests prove a
direct handler can be supplied `AcpRpcActor` without bearer headers.
[[acp-rpc-artifact-handlers]] now follows the same bridge for artifact mutation
actor attribution and workspace-read checks, with a direct artifact create
regression proving middleware-provided actor context still works without bearer
headers.

The actor bridge now also covers the split checkpoint and review modules.
[[acp-rpc-checkpoint-handlers]] and [[acp-rpc-review-handlers]] migrated their
`authorizeRpc` calls to `rpcActor`; `checkpoint.create` and `review.approve`
each gained a direct-handler regression proving a middleware-provided
`AcpRpcActor` short-circuits session lookup even when the supplied bearer token
would fail it (a deliberately invalid session id), confirming the bridge is
consulted before the bearer-header fallback rather than merely succeeding by
coincidence under permissive `requireAuth: false` defaults.

The actor-bridge sweep is now complete across every native handler vertical.
[[acp-rpc-handlers]] (`session.initialize`/`worker.*`/`workspace.*`/`work.*`/
`lease.*`) migrated its remaining `authorizeRpc` call sites to `rpcActor`, with
a `work.create` regression proving a middleware-provided `AcpRpcActor`
short-circuits session lookup even against a deliberately invalid bearer token.
No native RPC handler calls `authorizeRpc` directly anymore — `rpcActor` (which
still falls back to `authorizeRpc`'s bearer-header path when no `AcpRpcActor`
is in scope) is the only entry point.

The contract-scope parity audit the sweep was building toward is now done, with
a **decision to keep dual-layer authorization** rather than collapse to
middleware-only. Every scope annotation in [[acp-rpc-contract]] (`scoped(rpc,
'...')`) was compared against every handler's `rpcActor(options.headers,
'...')` call across all five handler files plus the aggregate module — **37
scoped operations, zero drift**; `session.initialize` is unscoped on both
sides. Despite the clean parity, handler-local checks stay: `.middleware(...)`
is attached at the `Rpc` definition level in [[acp-rpc-contract]], not the
transport, so every real `RpcServer`-mounted protocol (HTTP today, sockets or
workers later) already runs [[rpc-auth-middleware]] automatically — the *only*
path that bypasses it is the test-only `AcpRpcGroup.accessHandler` call used by
every handler test in this module (via [[acp-rpc-test-support]]). Removing
handler-local `rpcActor(..., scope)` checks would not simplify any production
request path; it would silently turn every existing handler-level
scope-denial regression (including the `work.publish_event` "lacks a read
scope" test and the per-vertical not-found/conflict tests gated behind a real
scope check) into a vacuous pass, since nothing would enforce scope when
middleware is bypassed. The in-memory cost of the duplicate check is
negligible, so this is a clear case for defense-in-depth over DRY: **handler-local
authorization stays permanently**, not as a temporary migration artifact.

With that decision closed, the live frontier returns to the broader
[[ADR-0007-effect-rpc-adoption]] migration: growing native RPC client coverage
(beyond [[acp-rpc-roundtrip-test]] and the [[native-rpc-route]] live-socket
regression) toward parity with the hand-mapped JSON-RPC method surface, so that
retiring `src/infrastructure/jsonrpc/` and the stdio/WebSocket JSON-RPC bridges
becomes a mechanical client-coverage check rather than a speculative cutover.

## Referenced by

[[architecture/_MOC]] · [[protocol-implementation-2026-06-27]] ·
[[spec-canonicalization]]
