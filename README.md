# Agent Coordination Protocol

Agent Coordination Protocol, or ACP, is a coordination layer for autonomous software workers operating in shared engineering workspaces. The protocol is concerned with state, ownership, recovery, and review. It does not prescribe how an agent reasons, edits files, calls models, or talks to a human; it defines the workspace facts that let independent workers cooperate without relying on conversational memory.

This repository is the TypeScript reference implementation for ACP v0.1. It is intentionally still in development, but it already contains the core in-memory host, domain services, HTTP transport, Server-Sent Events stream, and local `acp` command-line client. The current implementation is suitable for protocol design work, adapter development, and local integration experiments. It should not yet be treated as a production coordination server.

## Current Shape

ACP models a workspace as durable protocol state: workers register, work units move through explicit lifecycle transitions, leases protect resources, checkpoints make partial progress resumable, artifacts preserve outputs, reviews gate human decisions, and events record what happened over time. The implementation keeps those concepts in domain services behind an Effect Layer graph, with storage and transport held as seams rather than baked into the domain.

The current storage adapter is in-memory by design. That keeps the v0.1 host simple enough to reason about while the protocol surface settles, and it gives the later SQLite adapter a hard test of the storage boundary: persistence should arrive behind the existing seam, not by rewriting protocol behavior.

The HTTP server exposes the v0.1 REST surface and an SSE endpoint for workspace-scoped events. The CLI is a thin HTTP client of that local host, which means separate invocations share state through the running server instead of rebuilding an isolated application graph per command.

## Working Locally

The local server binds to `ACP_PORT`, defaulting to `4317`.

```bash
ACP_PORT=4317 node dist/app/server/main.js
```

The CLI targets `ACP_BASE_URL` when provided, otherwise it uses `http://localhost:$ACP_PORT`.

```bash
ACP_BASE_URL=http://localhost:4317 node dist/app/cli/main.js workspace list
ACP_BASE_URL=http://localhost:4317 node dist/app/cli/main.js work create "Fix login redirect" --workspace workspace_1
```

The package exposes an `acp` binary once built and linked or installed from the package. Until package distribution is formalized, direct `node dist/...` entrypoints are the most explicit local smoke path.

## Design Record

The repository is governed wiki-first. The canonical design record lives under `wiki/`, not in scattered comments or implied conventions. `wiki/00-INDEX.md` is the front door, `wiki/architecture/_MOC.md` tracks layer topology and build order, `wiki/CHANGELOG.md` records each logic slice, and `wiki/src/` mirrors `src/` one-for-one for source modules.

The architecture follows the accepted foundation in `wiki/decisions/ADR-0001-architecture-foundation.md`: ACP is the canonical protocol name, Effect Layers compose the runtime, Storage and Transport are explicit seams, schemas define the wire surface, and Node-specific implementations stay at application entrypoints.

## Repository Layout

The protocol schema lives in `src/protocol/schema`, with tagged protocol errors in `src/protocol/errors`. Domain behavior lives in `src/domain`, split by ACP concept. Infrastructure adapters live in `src/infrastructure`, including the storage seam, HTTP API declarations, error mapping, and SSE rendering. Application entrypoints live in `src/app`, where `app-live` composes the in-memory host, `server` binds HTTP, and `cli` provides the local command-line client.

## License

ACP is licensed under Apache-2.0. See `LICENSE`.
