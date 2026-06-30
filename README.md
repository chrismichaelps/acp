# Agent Coordination Protocol

Agent Coordination Protocol, or ACP, is a coordination layer for autonomous software workers operating in shared engineering workspaces. The protocol is concerned with state, ownership, recovery, and review. It does not prescribe how an agent reasons, edits files, calls models, or talks to a human; it defines the workspace facts that let independent workers cooperate without relying on conversational memory.

This repository is the TypeScript reference implementation for ACP v0.1. It is intentionally still in development, but it already contains the core host, domain services, storage seam, in-memory and SQLite storage adapters, REST transport, Server-Sent Events stream, first-party native Effect RPC over `/rpc/native`, JSON-RPC over `POST /rpc`, JSON-RPC over `GET /rpc` WebSocket, a stdio JSON-RPC bridge, and a local `acp` command-line client. The implementation is suitable for protocol design work, adapter development, and local integration experiments. It should not yet be treated as a production coordination server.

## Current Shape

ACP models a workspace as durable protocol state: workers register, work units move through explicit lifecycle transitions, leases protect resources, checkpoints make partial progress resumable, artifacts preserve outputs, reviews gate human decisions, and events record what happened over time. Review cancellation is represented as its own lifecycle event, `review.cancelled`, not as a rejection; cancelling a requested review withdraws the gate and lets the associated work continue. Worker presence is intentionally host-scoped rather than workspace event history: current worker records and statuses are readable through `GET /v1/workers`, `GET /v1/workers/:worker_id`, JSON-RPC `worker.list` and `worker.get`, and the matching CLI commands. Workspace event history is replayable through `GET /v1/events?workspace_id=...&after_seq=...`, JSON-RPC `events.list`, and `events list`, so a recovering worker can catch up before opening a live subscription. The implementation keeps those concepts in domain services behind an Effect Layer graph, with storage and transport held as seams rather than baked into the domain.

Storage is selected at the host boundary. The in-memory adapter keeps the default local path simple and deterministic, while the SQLite adapter provides durable state without changing domain behavior. SQLite uses the same storage port as memory, so persistence is an adapter concern rather than a protocol concern. That distinction matters for ACP because agents may hand off thousands of remembered facts, events, checkpoints, artifacts, and lease records over time; the database path has to preserve append order, replay efficiently, and keep queries scoped by workspace and key prefix rather than growing into a conversational-memory dump.

The HTTP server exposes the v0.1 REST surface and an SSE endpoint for workspace-scoped events. Bearer sessions are optional in local mode and can be required with configuration for hardened hosts; `session.initialize` remains the open bootstrap route because it mints the session used by later scoped calls. When a bearer session is presented, mutation routes enforce scoped permissions for work, leases, artifacts, checkpoints, reviews, and workspace changes, including destructive and review-outcome actions, while worker registry reads use `worker:read` and event replay uses `event:read`. Lease lifecycle is fully transport-backed: beyond request and release, long-running workers can extend an advisory claim through `POST /v1/leases/:lease_id/renew` and supervisors can reclaim a stale or unsafe lease through `POST /v1/leases/:lease_id/revoke`, each gated by its own `lease:renew` and `lease:revoke` scope. Review cancellation is also transport-backed through `POST /v1/reviews/:review_id/cancel`, JSON-RPC `review.cancel`, and CLI `review cancel`, with a dedicated `review:cancel` scope. The CLI is a thin HTTP client of that local host, which means separate invocations share state through the running server instead of rebuilding an isolated application graph per command.

Native RPC is the first-party TypeScript transport for ACP consumers that can use Effect directly. The host mounts the generated `@effect/rpc` contract at `/rpc/native` with NDJSON framing so unary calls and `events.subscribe` streaming share one protocol path. The native route uses the same application graph as REST, JSON-RPC, WebSocket JSON-RPC, and the sweeper, so sessions, workspaces, leases, events, memory, checkpoints, artifacts, and reviews remain shared across transports. The native client and mounted HTTP route are covered across the implemented handler verticals, and every native RPC operation carries structured Effect telemetry with operation name, outcome, duration, client id, and stable ACP error code when one exists.

JSON-RPC remains the compatibility transport rather than the center of new first-party client work. `POST /rpc` executes JSON-RPC 2.0 envelopes against the shared router, preserving request correlation, batch handling, and notification semantics; every REST mutation has a paired method, including `lease.renew` and `lease.revoke` for the lease lifecycle calls above. The `acp-jsonrpc-stdio` bridge reads Content-Length framed messages from stdin and forwards them to that same endpoint, so stdio integrations do not need a separate domain runtime. `GET /rpc` upgrades to a WebSocket and frames the same JSON-RPC surface over a persistent connection: each text frame is one request, the reply is one text frame, and the connection's bearer token comes from the handshake `Authorization` header or a `?token=` query parameter for browser clients that cannot set handshake headers. A single `events.subscribe` request on that WebSocket acknowledges the subscription and delivers later workspace events as JSON-RPC `events.event` notifications; SSE remains the HTTP live-event channel.

## Working Locally

The local server binds to `ACP_PORT`, defaulting to `4317`.

```bash
ACP_PORT=4317 node dist/app/server/main.js
```

By default the host uses in-memory storage. To use SQLite, set `ACP_STORAGE_ADAPTER=sqlite` and provide `ACP_SQLITE_PATH`; the adapter creates its schema on startup and stores protocol state and append-only events in the configured database file.

```bash
ACP_STORAGE_ADAPTER=sqlite ACP_SQLITE_PATH=.acp/acp.sqlite node dist/app/server/main.js
```

Local development allows unauthenticated requests unless `ACP_REQUIRE_AUTH=true` is set. With auth required, callers first initialize a session and then pass the returned session id as a bearer token on scoped routes. The CLI forwards `ACP_RPC_TOKEN` as that bearer token for ordinary requests and event streams, matching the stdio bridge convention for long-lived integrations. Session permissions are explicit strings such as `work:create`, `artifact:delete`, and `review:approve`; presenting a token without the required scope returns `401 Unauthorized`. Runtime logs are emitted through Effect's structured logger; `ACP_LOG_LEVEL` accepts `debug`, `info`, `warn`, or `error`, defaulting to `info`.

The CLI targets `ACP_BASE_URL` when provided, otherwise it uses `http://localhost:$ACP_PORT`. It covers the local command surface for worker registry reads, workspace create/update/archive, work creation and lifecycle updates, lease request/renew/revoke/release, artifact create/update/delete, checkpoint creation, review request/approve/reject/request-changes/cancel, event replay, and event streaming.

```bash
ACP_BASE_URL=http://localhost:4317 node dist/app/cli/main.js workspace list
ACP_BASE_URL=http://localhost:4317 node dist/app/cli/main.js work create "Fix login redirect" --workspace workspace_1
```

The package exposes an `acp` binary once built and linked or installed from the package. It also exposes `acp-jsonrpc-stdio`, which reads Content-Length framed JSON-RPC messages from stdin, forwards them to the local host's `POST /rpc` endpoint, and writes framed responses to stdout. Until package distribution is formalized, direct `node dist/...` entrypoints are the most explicit local smoke path.

The stdio bridge targets the same `ACP_BASE_URL` and `ACP_PORT` convention as the CLI. If a long-lived stdio integration already has a session id, `ACP_RPC_TOKEN` forwards that value as a bearer token on every `/rpc` call.

The normal verification path is TypeScript typechecking, ESLint, targeted subsystem tests, and the full Vitest suite. The SQLite adapter uses Node's `node:sqlite` module, so current Node releases print an experimental SQLite warning during storage tests; that warning is expected and is not a test failure.

## Design Record

The repository is governed wiki-first. The canonical design record lives under `wiki/`, not in scattered comments or implied conventions. `wiki/00-INDEX.md` is the front door, `wiki/architecture/_MOC.md` tracks layer topology and build order, `wiki/CHANGELOG.md` records each logic slice, and `wiki/src/` mirrors `src/` one-for-one for source modules. The tracked `specs.md` file is the working draft of the protocol; the wiki records how each implementation slice interprets and narrows that draft.

The architecture follows the accepted foundation in `wiki/decisions/ADR-0001-architecture-foundation.md`: ACP is the canonical protocol name, Effect Layers compose the runtime, Storage and Transport are explicit seams, and schemas define the wire surface. Node-specific runtime adapters live under `src/infrastructure/platform-node`; application entrypoints provide those adapters rather than constructing raw Node resources inline.

## Repository Layout

The protocol schema lives in `src/protocol/schema`, with tagged protocol errors in `src/protocol/errors`. Domain behavior lives in `src/domain`, split by ACP concept. Infrastructure adapters live in `src/infrastructure`, including the storage seam, memory and SQLite stores, HTTP API declarations, JSON-RPC mapping, error mapping, SSE rendering, and Node platform adapters for server sockets and process IO. Application entrypoints live in `src/app`, where `app-live` composes the host, `server` launches HTTP, `stdio` bridges JSON-RPC framing, and `cli` provides the local command-line client.

## License

ACP is licensed under Apache-2.0. See `LICENSE`.
