# Agent Coordination Protocol (ACP) Specification v0.1

**Status:** Draft  
**Protocol name:** Agent Coordination Protocol (ACP)  
**Short description:** A vendor-neutral coordination protocol for autonomous software engineering agents.

---

## 1. Purpose

ACP defines a shared workspace protocol for AI coding agents, humans, IDEs, CLIs, and orchestration systems.

It allows agents such as Claude Code, Codex, Aider, OpenHands, Gemini CLI, or custom agents to coordinate work through shared state rather than through chat.

ACP does not define how an agent thinks, edits code, calls tools, or uses models. It defines how software workers coordinate around workspaces, tasks, leases, artifacts, checkpoints, events, and reviews.

---

## 2. The Core Question

ACP answers this question:

> How can multiple autonomous software workers coordinate work safely across shared repositories and workspaces?

It specifically answers:

1. Who is working on this?
2. What is the current state of the work?
3. What resources are claimed or locked?
4. What changed?
5. What artifacts were produced?
6. Can another worker resume the task?
7. Is human review required?
8. What happened over time?

---

## 3. Non-Goals

ACP is not:

- A chat protocol
- An AI model protocol
- An IDE protocol
- A replacement for Git
- A replacement for GitHub, GitLab, or Bitbucket
- A replacement for MCP
- A task manager
- A workflow engine
- A prompt format
- A memory database

ACP can integrate with all of these, but it does not replace them.

---

## 4. Design Principles

### 4.1 State-first, not message-first

Agents do not coordinate by sending casual messages. They coordinate by publishing state changes.

Example:

```json
{
  "type": "work.claimed",
  "work_id": "work_123",
  "agent_id": "agent_claude"
}
```

### 4.2 Vendor-neutral

The protocol must work with Claude Code, Codex, Aider, OpenHands, Gemini CLI, local agents, and future agents.

### 4.3 Host-neutral

The protocol must work inside:

- Desktop apps
- CLIs
- IDEs
- CI/CD systems
- GitHub Apps
- Cloud orchestrators
- Local development machines

### 4.4 Git-aware, not Git-dependent

Git is the primary use case, but ACP primitives should not require Git-specific assumptions.

### 4.5 Human-in-the-loop

Humans must be able to inspect, approve, reject, pause, or resume work.

### 4.6 Append-only event history

All important protocol activity should be represented as events.

### 4.7 Recoverable work

An agent should be able to stop, crash, or hand off work without losing useful state.

---

## 5. Terminology

### Host

The application or environment that provides a ACP workspace.

Examples:

- Tauri desktop app
- CLI daemon
- Cloud service
- IDE extension
- GitHub App

### Worker

Any actor that performs or supervises work.

Examples:

- Claude Code
- Codex
- Aider
- OpenHands
- Human developer
- CI bot
- QA agent

### Workspace

A logical environment where work happens.

A workspace may map to:

- A local repository
- A Git worktree
- A GitHub repository
- A monorepo package
- A CI execution environment
- A cloud sandbox

### Work Unit

A unit of work to be completed.

Examples:

- Fix a bug
- Implement a feature
- Review a PR
- Write tests
- Investigate CI failure
- Refactor a module

### Lease

A temporary claim over a resource.

Examples:

- A file
- A branch
- A worktree
- A task
- A package
- A database migration

### Artifact

A durable output of work.

Examples:

- Patch
- Diff
- Pull request URL
- Test report
- Screenshot
- Terminal log
- Markdown report
- Migration file

### Checkpoint

A resumable summary of partial progress.

### Review

An explicit approval, rejection, or feedback step.

### Event

An immutable record of something that happened.

---

## 6. Protocol Actors

```text
Worker
  |
  | ACP Client
  v
ACP Host
  |
  v
Workspace State Store
```

A worker talks to a ACP host through a ACP client.

The host owns:

- Workspace state
- Worker registry
- Work units
- Leases
- Events
- Artifacts
- Checkpoints
- Reviews

---

## 7. Transport

ACP v0.1 supports two transports:

1. HTTP + Server-Sent Events
2. JSON-RPC 2.0 over stdio or WebSocket

Implementations may support one or both.

Recommended MVP transport:

- HTTP REST for commands
- Server-Sent Events for live event streaming

---

## 8. Authentication

ACP v0.1 supports bearer tokens.

```http
Authorization: Bearer acp_xxx
```

Workers should be scoped by permissions.
Reference hosts may run in local development mode with unauthenticated mutations
attributed to a system actor. A hardened host should expose an explicit
`ACP_REQUIRE_AUTH` configuration switch; when enabled, every route that mutates or
reads scoped workspace state must reject requests without a valid bearer session
with `401 Unauthorized`. `POST /v1/session/initialize` remains the open bootstrap
route because it mints the bearer session used by later calls.

The v0.1 permission vocabulary is closed so a host can reject unknown scopes
during session initialization instead of silently accepting misspelled or
future-version authority. Permissions are intentionally action-oriented rather
than role-oriented; hosts may compose them into local roles, but protocol
messages carry the explicit scope strings.

| Scope | Grants |
| --- | --- |
| `worker:read` | Read host-scoped worker registry records. |
| `workspace:read` | Read workspace records and workspace-scoped aggregate indexes. |
| `workspace:write` | Create, update, or archive workspace records. |
| `event:read` | Replay persisted workspace event history. |
| `work:create` | Create WorkUnits. |
| `work:claim` | Claim WorkUnits by creating leases. |
| `work:update` | Mutate WorkUnit state such as progress, block, resume, or completion. |
| `work:publish_event` | Publish WorkUnit progress or diagnostic events. |
| `lease:create` | Create advisory leases for WorkUnits. |
| `lease:renew` | Extend an existing lease before expiry. |
| `lease:release` | Release a lease voluntarily. |
| `lease:revoke` | Revoke another worker's stale or unsafe lease. |
| `artifact:create` | Attach host-stored content or external artifact references. |
| `artifact:update` | Replace artifact metadata, content, or external URI references. |
| `artifact:delete` | Delete artifact records. |
| `checkpoint:create` | Create resumability checkpoints. |
| `review:create` | Request a review gate for a WorkUnit. |
| `review:approve` | Approve a requested review. |
| `review:reject` | Reject a requested review. |
| `review:request_changes` | Mark a requested review as requiring changes. |
| `review:cancel` | Withdraw a requested review without creating a reviewer outcome. |

---

## 9. Capability Negotiation

When connecting, a worker must identify itself and declare capabilities.

### Request

```http
POST /v1/session/initialize
```

```json
{
  "protocol_version": "0.1",
  "worker": {
    "id": "agent_claude_code",
    "name": "Claude Code",
    "kind": "agent",
    "vendor": "anthropic"
  },
  "capabilities": {
    "can_edit_files": true,
    "can_run_commands": true,
    "can_create_prs": false,
    "can_review": true,
    "supports_checkpoints": true,
    "supports_leases": true
  }
}
```

### Response

```json
{
  "session_id": "session_abc123",
  "protocol_version": "0.1",
  "host": {
    "name": "ACP Local",
    "kind": "local"
  },
  "capabilities": {
    "supports_events": true,
    "supports_reviews": true,
    "supports_artifacts": true,
    "supports_sse": true
  }
}
```

---

## 10. Core Objects

### 10.1 Worker

```json
{
  "id": "agent_claude_code",
  "name": "Claude Code",
  "kind": "agent",
  "vendor": "anthropic",
  "status": "online",
  "capabilities": {}
}
```

Allowed `kind` values:

- `human`
- `agent`
- `bot`
- `ci`
- `system`

Allowed `status` values:

- `online`
- `idle`
- `busy`
- `blocked`
- `offline`

---

### 10.2 Workspace

```json
{
  "id": "workspace_123",
  "name": "example/project",
  "kind": "git_repository",
  "uri": "git+https://example.com/acp/project.git",
  "default_branch": "main",
  "metadata": {
    "provider": "github"
  }
}
```

Allowed `kind` values:

- `git_repository`
- `git_worktree`
- `directory`
- `container`
- `cloud_sandbox`
- `ci_job`

---

### 10.3 Work Unit

```json
{
  "id": "work_123",
  "workspace_id": "workspace_123",
  "title": "Fix login redirect bug",
  "description": "Users are redirected to /dashboard before session creation completes.",
  "state": "open",
  "priority": "high",
  "created_by": "human_chris",
  "assigned_to": null,
  "created_at": "2026-06-25T19:00:00Z",
  "updated_at": "2026-06-25T19:00:00Z"
}
```

Allowed `state` values:

- `open`
- `claimed`
- `running`
- `blocked`
- `needs_review`
- `approved`
- `rejected`
- `completed`
- `cancelled`

---

### 10.4 Lease

```json
{
  "id": "lease_123",
  "workspace_id": "workspace_123",
  "work_id": "work_123",
  "holder": "agent_claude_code",
  "resource": {
    "kind": "file",
    "uri": "file://src/auth/callback.ts"
  },
  "expires_at": "2026-06-25T19:15:00Z",
  "state": "active"
}
```

Allowed lease states:

- `active`
- `expired`
- `released`
- `revoked`

Resource kinds:

- `file`
- `directory`
- `branch`
- `worktree`
- `task`
- `service`
- `database_migration`
- `custom`

---

### 10.5 Artifact

```json
{
  "id": "artifact_123",
  "work_id": "work_123",
  "workspace_id": "workspace_123",
  "created_by": "agent_claude_code",
  "kind": "patch",
  "uri": "acp://artifacts/artifact_123",
  "media_type": "text/x-patch",
  "summary": "Fixes auth redirect timing issue.",
  "created_at": "2026-06-25T19:08:00Z"
}
```

Artifact kinds:

- `patch`
- `diff`
- `commit`
- `pull_request`
- `test_report`
- `log`
- `screenshot`
- `markdown`
- `json`
- `binary`
- `custom`

---

### 10.6 Checkpoint

```json
{
  "id": "checkpoint_123",
  "work_id": "work_123",
  "workspace_id": "workspace_123",
  "created_by": "agent_claude_code",
  "summary": "Found bug in auth callback. Session creation is async but redirect happens immediately.",
  "completed_steps": [
    "Inspected src/auth/callback.ts",
    "Added failing test"
  ],
  "remaining_steps": [
    "Update redirect logic",
    "Run auth tests"
  ],
  "modified_resources": [
    "file://src/auth/callback.ts",
    "file://tests/auth/callback.test.ts"
  ],
  "created_at": "2026-06-25T19:10:00Z"
}
```

---

### 10.7 Review

```json
{
  "id": "review_123",
  "work_id": "work_123",
  "requested_by": "agent_claude_code",
  "reviewer": "human_chris",
  "state": "requested",
  "requirements": [
    "diff_review",
    "tests_pass"
  ],
  "created_at": "2026-06-25T19:12:00Z"
}
```

Allowed review states:

- `requested`
- `approved`
- `rejected`
- `changes_requested`
- `cancelled`

---

### 10.8 Event

```json
{
  "id": "event_123",
  "type": "work.claimed",
  "workspace_id": "workspace_123",
  "work_id": "work_123",
  "actor": "agent_claude_code",
  "timestamp": "2026-06-25T19:02:00Z",
  "data": {}
}
```

---

## 11. Event Types

### Worker Events

- `worker.online`
- `worker.offline`
- `worker.status_changed`

### Workspace Events

- `workspace.created`
- `workspace.updated`
- `workspace.archived`

### Work Events

- `work.created`
- `work.claimed`
- `work.started`
- `work.progressed`
- `work.blocked`
- `work.unblocked`
- `work.needs_review`
- `work.completed`
- `work.cancelled`

### Lease Events

- `lease.requested`
- `lease.granted`
- `lease.denied`
- `lease.renewed`
- `lease.released`
- `lease.expired`
- `lease.revoked`

### Artifact Events

- `artifact.created`
- `artifact.updated`
- `artifact.deleted`

### Checkpoint Events

- `checkpoint.created`

### Review Events

- `review.requested`
- `review.approved`
- `review.rejected`
- `review.changes_requested`
- `review.cancelled`

---

## 12. HTTP API

### 12.1 Initialize Session

```http
POST /v1/session/initialize
```

Creates a worker session and negotiates capabilities.

---

### 12.2 List Workspaces

```http
GET /v1/workspaces
```

---

### 12.3 Create Work Unit

```http
POST /v1/work
```

```json
{
  "workspace_id": "workspace_123",
  "title": "Fix login redirect bug",
  "description": "Users are redirected before session creation completes.",
  "priority": "high"
}
```

---

### 12.4 Claim Work

```http
POST /v1/work/{work_id}/claim
```

```json
{
  "worker_id": "agent_claude_code"
}
```

---

### 12.5 Update Work State

```http
PATCH /v1/work/{work_id}
```

```json
{
  "state": "running"
}
```

---

### 12.6 Publish Progress

```http
POST /v1/work/{work_id}/events
```

```json
{
  "type": "work.progressed",
  "data": {
    "message": "Found redirect logic in src/auth/callback.ts"
  }
}
```

---

### 12.7 Request Lease

```http
POST /v1/leases
```

```json
{
  "workspace_id": "workspace_123",
  "work_id": "work_123",
  "holder": "agent_claude_code",
  "resource": {
    "kind": "file",
    "uri": "file://src/auth/callback.ts"
  },
  "ttl_seconds": 900
}
```

---

### 12.8 Release Lease

```http
POST /v1/leases/{lease_id}/release
```

---

### 12.9 Create Artifact

```http
POST /v1/artifacts
```

```json
{
  "workspace_id": "workspace_123",
  "work_id": "work_123",
  "kind": "patch",
  "media_type": "text/x-patch",
  "summary": "Fixes login redirect bug.",
  "content": "diff --git ..."
}
```

---

### 12.10 Create Checkpoint

```http
POST /v1/checkpoints
```

```json
{
  "workspace_id": "workspace_123",
  "work_id": "work_123",
  "summary": "Bug found in async redirect flow.",
  "completed_steps": [],
  "remaining_steps": [],
  "modified_resources": []
}
```

---

### 12.11 Request Review

```http
POST /v1/reviews
```

```json
{
  "work_id": "work_123",
  "requested_by": "agent_claude_code",
  "reviewer": "human_chris",
  "requirements": ["diff_review", "tests_pass"]
}
```

---

### 12.12 Cancel Review

```http
POST /v1/reviews/{review_id}/cancel
```

Cancelling a requested review withdraws the review gate without treating the
review as rejected. The associated work unit returns to `running`, and the host
emits `review.cancelled`.

---

### 12.13 Subscribe to Events

```http
GET /v1/events/stream?workspace_id=workspace_123
```

Server-Sent Events response:

```text
event: work.claimed
data: {"work_id":"work_123","actor":"agent_claude_code"}
```

---

## 13. JSON-RPC API

Optional JSON-RPC method names:

- `session.initialize`
- `workspace.list`
- `work.create`
- `work.claim`
- `work.update`
- `lease.request`
- `lease.release`
- `artifact.create`
- `checkpoint.create`
- `review.request`
- `review.cancel`
- `events.subscribe`

Example:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "work.claim",
  "params": {
    "work_id": "work_123",
    "worker_id": "agent_claude_code"
  }
}
```

---

## 14. State Machine

Work unit state transitions:

```text
open
  -> claimed
  -> running
  -> blocked
  -> running
  -> needs_review
  -> approved
  -> completed
```

Alternative transitions:

```text
open -> cancelled
claimed -> cancelled
running -> cancelled
needs_review -> rejected
needs_review -> changes_requested -> running
needs_review -> running (when a requested review is cancelled)
```

Invalid transitions should return `409 Conflict`.

---

## 15. Error Format

```json
{
  "error": {
    "code": "lease_conflict",
    "message": "Resource is already leased by another worker.",
    "details": {
      "resource": "file://src/auth/callback.ts",
      "holder": "agent_codex"
    }
  }
}
```

Common error codes:

- `invalid_request`
- `unauthorized`
- `forbidden`
- `not_found`
- `conflict`
- `lease_conflict`
- `invalid_state_transition`
- `unsupported_capability`
- `rate_limited`
- `internal_error`

---


## 16. Reference Implementation Standards

The first reference implementation of ACP will use a TypeScript-first stack. These requirements are part of the project specification, not part of the wire protocol. Other implementations may use different languages as long as they remain protocol-compatible.

### 16.1 Runtime and package management

The official reference implementation must use:

- **Node.js v24** through `nvm use v24`
- **pnpm** as the only package manager
- **TypeScript** for all application, SDK, CLI, and server code
- **ESLint** for static analysis
- **Prettier** for formatting

Required setup commands:

```bash
nvm use v24
corepack enable
pnpm install
pnpm lint
pnpm format
pnpm test
pnpm typecheck
```

The repository must include:

```text
.nvmrc
package.json
pnpm-lock.yaml
tsconfig.json
eslint.config.ts
.prettierrc
```

`.nvmrc` must contain:

```text
24
```

### 16.2 Effect as the application foundation

The reference implementation must use **Effect** as the main application architecture layer. Effect is used because ACP needs typed errors, dependency injection, configuration, schema validation, resource-safe services, and composable runtime layers.

Effect usage is mandatory in these areas:

- Service composition
- Runtime dependency graph
- Configuration loading
- Protocol schema validation
- Tagged domain errors
- Async workflows
- Resource lifecycle management
- Test dependency replacement

The implementation must follow the Effect Layer pattern for **Designing the Dependency Graph**. Services should expose clean interfaces, while construction details are composed through Layers.

### 16.3 Effect Layer dependency graph

Each major capability must be represented as an Effect service and provided through a Layer.

Example service graph:

```text
ConfigLayer
  ├── LoggerLayer
  ├── DatabaseLayer
  │     └── EventStoreLayer
  ├── WorkspaceLayer
  ├── LeaseLayer
  ├── ArtifactLayer
  ├── CheckpointLayer
  ├── ReviewLayer
  └── TransportLayer
        ├── HttpApiLayer
        └── SseEventStreamLayer
```

Rules:

- No global singletons.
- No hidden process-level mutable state.
- Every service dependency must be explicit in the Effect environment.
- Production, test, and in-memory implementations must be swappable through Layers.
- Long-lived resources, such as database connections and event streams, must use scoped Layers.

### 16.4 Effect Schema

All protocol payloads must be defined with **Effect Schema**.

Required schema domains:

```text
src/protocol/schema/
  work-unit.schema.ts
  worker.schema.ts
  workspace.schema.ts
  lease.schema.ts
  artifact.schema.ts
  checkpoint.schema.ts
  review.schema.ts
  event.schema.ts
  error.schema.ts
```

Rules:

- No unvalidated external input may enter domain logic.
- HTTP request bodies must be decoded with Effect Schema before use.
- Event payloads must be encoded and decoded through Effect Schema.
- Schema definitions are the source of truth for TypeScript types.
- OpenAPI generation, if added later, must derive from these schemas.

Example style:

```ts
import { Schema } from "effect"

export const WorkId = Schema.String.pipe(Schema.brand("WorkId"))
export type WorkId = Schema.Schema.Type<typeof WorkId>

export const WorkUnit = Schema.Struct({
  id: WorkId,
  title: Schema.NonEmptyString,
  state: Schema.Literal(
    "open",
    "claimed",
    "running",
    "blocked",
    "needs_review",
    "approved",
    "completed",
    "cancelled"
  )
})
export type WorkUnit = Schema.Schema.Type<typeof WorkUnit>
```

### 16.5 Effect Config

Magic constants are forbidden. Values that affect runtime behavior must be represented with **Effect Config**.

Examples:

```text
ACP_PORT
ACP_DATABASE_URL
ACP_EVENT_RETENTION_DAYS
ACP_DEFAULT_LEASE_TTL_SECONDS
ACP_MAX_ARTIFACT_SIZE_MB
ACP_SSE_HEARTBEAT_SECONDS
ACP_LOG_LEVEL
ACP_REQUIRE_AUTH
```

Rules:

- Do not hardcode ports, timeouts, TTL values, retention windows, file size limits, or feature flags.
- Every environment variable must have a typed Config definition.
- Defaults must be explicit and documented.
- Config must be provided as a Layer.

Suggested folder:

```text
src/config/
  app-config.ts
  app-config.layer.ts
```

### 16.6 Tagged errors

All domain errors must use Effect tagged errors. Throwing raw `Error` from domain code is not allowed.

Required error families:

```text
src/domain/errors/
  protocol-error.ts
  validation-error.ts
  lease-error.ts
  workspace-error.ts
  artifact-error.ts
  checkpoint-error.ts
  review-error.ts
  storage-error.ts
  auth-error.ts
```

Example style:

```ts
import { Data } from "effect"

export class LeaseConflictError extends Data.TaggedError("LeaseConflictError")<{
  readonly resourceUri: string
  readonly holderWorkerId: string
}> {}

export class InvalidStateTransitionError extends Data.TaggedError("InvalidStateTransitionError")<{
  readonly from: string
  readonly to: string
}> {}
```

Rules:

- Errors must be typed and recoverable.
- Transport adapters must map tagged errors to protocol error responses.
- Domain services must return typed failures through `Effect.Effect<Success, DomainError, Requirements>`.
- Unknown defects must be logged and converted to `internal_error` only at the transport boundary.

### 16.7 Effect data structures

The reference implementation must prefer **Effect immutable data structures** for protocol state, domain indexes, event processing, and any collection that crosses service boundaries. Native JavaScript collections are allowed only at external boundaries or for short-lived local implementation details that do not escape the function.

Required imports should come from `effect`:

```ts
import { Chunk, HashMap, HashSet, Option, Either, Data, Duration } from "effect"
```

Required usage:

```text
HashMap
  Use for keyed domain indexes, such as workers by ID, work units by ID, leases by resource URI, artifacts by ID, and checkpoint lookup tables.

HashSet
  Use for unique collections, such as worker capabilities, subscribed event types, workspace members, held lease IDs, and artifact references.

Chunk
  Use for immutable ordered protocol collections, such as event batches, artifact lists, checkpoint history, timeline pages, and review comments.

Option
  Use instead of `null` or `undefined` for optional domain values.

Either
  Use for pure validation or parsing helpers when a full Effect is not required. Domain services should usually return `Effect.Effect<Success, DomainError, Requirements>`.

Data
  Use `Data.TaggedError`, `Data.TaggedClass`, or readonly value objects for structurally comparable domain models.

Duration
  Use for TTLs, lease durations, heartbeat intervals, retry delays, and timeout values. Durations must be loaded through Effect Config when configurable.
```

Rules:

- Do not expose mutable `Map`, `Set`, or arrays from domain services.
- Do not use `null` for absence in protocol or domain code. Use `Option`.
- Do not use mutable arrays for event batches or timelines. Use `Chunk`.
- Use `HashMap` and `HashSet` when collection equality, immutability, and safe sharing matter.
- Convert native JavaScript structures at the boundary, then keep internal logic in Effect data structures.
- Schema encoding and decoding must explicitly handle Effect data structures when they need JSON representation.
- For JSON payloads, encode `HashMap` as records or arrays of entries, `HashSet` as arrays, `Chunk` as arrays, and `Option` as nullable or omitted fields only at the transport boundary.

Suggested folder hierarchy:

```text
src/
  domain/
    collections/
      worker-index.ts
      work-unit-index.ts
      lease-index.ts
      artifact-index.ts
      event-batch.ts

  protocol/
    codecs/
      hashmap-codec.ts
      hashset-codec.ts
      chunk-codec.ts
      option-codec.ts
```

Example style:

```ts
import { HashMap, HashSet, Option } from "effect"

import type { WorkerId, WorkId, Capability } from "../schema/worker.schema"

export interface WorkerIndex {
  readonly byId: HashMap.HashMap<WorkerId, WorkerRecord>
  readonly capabilitiesByWorker: HashMap.HashMap<WorkerId, HashSet.HashSet<Capability>>
}

export const findWorker = (
  index: WorkerIndex,
  workerId: WorkerId
): Option.Option<WorkerRecord> => HashMap.get(index.byId, workerId)
```

### 16.8 Effect Platform for server and runtime adapters

Any ACP reference server, CLI runtime, daemon, or local host process must use **Effect Platform** instead of raw Node.js APIs whenever Effect Platform provides the needed abstraction.

Effect Platform is required because ACP must be portable, testable, and explicit about runtime dependencies. The implementation should depend on Effect services and Layers, then provide the Node-specific implementations only at the application edge.

Required packages for the Node.js reference implementation:

```bash
pnpm add effect @effect/platform @effect/platform-node
```

Required package roles:

```text
effect
  Core Effect runtime, Layer, Schema, Config, Data.TaggedError, Stream, Queue, PubSub.

@effect/platform
  Platform-independent abstractions for filesystem, path, terminal, command execution, key-value storage, HTTP, sockets, and runtime services.

@effect/platform-node
  Node.js-specific Layer implementations for the platform abstractions. This package is provided only in the final server, CLI, or daemon entrypoint.
```

Server rules:

- HTTP servers must be defined through Effect Platform HTTP abstractions, not directly through Express, Fastify, raw `http`, or untyped handlers.
- Filesystem access must use Effect Platform `FileSystem`.
- Path operations must use Effect Platform `Path`.
- Terminal and CLI IO must use Effect Platform `Terminal`.
- Shell or subprocess execution must use Effect Platform `Command`.
- Platform-specific implementations must live under `src/infrastructure/platform-node/`.
- Domain and protocol code must not import Node built-ins such as `fs`, `path`, `child_process`, `http`, or `process` directly.
- Node-specific Layers must be wired only in application entrypoints such as `apps/server/main.ts` and `apps/cli/main.ts`.

Recommended server layer graph:

```text
NodeRuntimeLayer
  ├── NodeFileSystemLayer
  ├── NodePathLayer
  ├── NodeTerminalLayer
  ├── NodeCommandLayer
  ├── AppConfigLayer
  ├── LoggerLayer
  ├── StorageLayer
  ├── ACPDomainLayer
  └── ACPHttpServerLayer
```

Recommended server folders:

```text
src/
  infrastructure/
    platform-node/
      node-runtime.layer.ts
      node-filesystem.layer.ts
      node-command.layer.ts

    http/
      acp-http-api.ts
      acp-http-server.layer.ts
      http-error-mapper.ts

    sse/
      sse-event-stream.layer.ts

  apps/
    server/
      main.ts
      server.layer.ts
```

HTTP API requirements:

- Request bodies must be decoded with Effect Schema before entering domain services.
- Responses must be encoded from Effect Schema-backed protocol objects.
- Tagged domain errors must be mapped to stable ACP protocol errors at the HTTP boundary.
- Streaming endpoints must use Effect Streams or platform socket/HTTP streaming abstractions.
- Long-running server resources must be scoped and released by Effect.

The preferred boundary is:

```text
Effect Platform HTTP request
  ↓
Schema decode
  ↓
Domain service
  ↓
Tagged error mapping
  ↓
Schema encode
  ↓
Effect Platform HTTP response
```

This rule exists so the protocol implementation remains senior-level infrastructure code instead of a collection of untyped route handlers.

### 16.8 Folder hierarchy

The codebase must be organized by protocol capability. Each folder owns its schema, service, layer, errors, tests, and transport adapter when applicable.

Required structure:

```text
src/
  config/
    app-config.ts
    app-config.layer.ts

  protocol/
    schema/
    errors/
    codecs/
    version.ts

  domain/
    work-units/
      work-unit.schema.ts
      work-unit.service.ts
      work-unit.layer.ts
      work-unit.errors.ts
      work-unit.test.ts
    workers/
      worker.schema.ts
      worker.service.ts
      worker.layer.ts
      worker.errors.ts
      worker.test.ts
    workspaces/
      workspace.schema.ts
      workspace.service.ts
      workspace.layer.ts
      workspace.errors.ts
      workspace.test.ts
    leases/
      lease.schema.ts
      lease.service.ts
      lease.layer.ts
      lease.errors.ts
      lease.test.ts
    artifacts/
      artifact.schema.ts
      artifact.service.ts
      artifact.layer.ts
      artifact.errors.ts
      artifact.test.ts
    checkpoints/
      checkpoint.schema.ts
      checkpoint.service.ts
      checkpoint.layer.ts
      checkpoint.errors.ts
      checkpoint.test.ts
    reviews/
      review.schema.ts
      review.service.ts
      review.layer.ts
      review.errors.ts
      review.test.ts
    events/
      event.schema.ts
      event-store.service.ts
      event-store.layer.ts
      event.errors.ts
      event-store.test.ts

  infrastructure/
    database/
    filesystem/
    git/
    github/
    platform-node/
    http/
    sse/
    logger/

  apps/
    server/
    cli/
    sdk/
```

### 16.9 File size and maintainability rule

No source file may exceed **500 lines of code**.

Rules:

- Split large files by capability, adapter, or schema domain.
- Tests may also follow the 500-line limit unless a generated fixture requires otherwise.
- Generated files must be placed under `generated/` and must not be manually edited.
- ESLint or a custom CI script must fail the build when a non-generated source file exceeds 500 lines.

Suggested script:

```bash
pnpm check:file-size
```

### 16.10 Formatting and linting rules

The reference implementation must enforce formatting and linting in CI.

Required commands:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Rules:

- Prettier owns formatting.
- ESLint owns code quality rules.
- TypeScript must run in strict mode.
- `any` is forbidden unless isolated behind a transport boundary with a comment explaining why.
- Runtime input validation must use Effect Schema, not manual ad hoc checks.

---
## 17. Minimal Local Implementation

A minimal ACP host should include:

- HTTP server
- SQLite database
- Event table
- Work table
- Worker table
- Lease table
- Artifact table
- Checkpoint table
- Review table
- SSE event stream
- CLI client

Suggested stack:

- Node.js v24 for the reference server
- pnpm for package management
- TypeScript for server, SDK, and CLI
- Effect for Layers, Schema, Config, tagged errors, async workflows, and service composition
- Effect Platform plus `@effect/platform-node` for the server, CLI runtime, filesystem, command execution, HTTP, streaming, and Node-specific runtime Layers
- SQLite for local storage
- Tauri for the optional desktop UI
- Python SDK may be added after the TypeScript SDK is stable

---

## 18. Example Flow

### Step 1: Human creates work

```json
{
  "title": "Fix login redirect bug"
}
```

### Step 2: Claude claims work

```json
{
  "type": "work.claimed",
  "actor": "agent_claude_code"
}
```

### Step 3: Claude leases files

```json
{
  "resource": {
    "kind": "file",
    "uri": "file://src/auth/callback.ts"
  }
}
```

### Step 4: Claude publishes checkpoint

```json
{
  "summary": "Found async redirect issue. Test added. Fix pending."
}
```

### Step 5: Claude creates artifact

```json
{
  "kind": "patch",
  "summary": "Fix redirect by awaiting session creation."
}
```

### Step 6: QA agent picks up work

```json
{
  "type": "work.claimed",
  "actor": "agent_qa"
}
```

### Step 7: Human approves review

```json
{
  "state": "approved"
}
```

---

## 19. Security Considerations

Hosts must treat agents as untrusted workers.

Recommended controls:

- Scoped tokens
- Per-worker permissions
- Workspace-level access control
- Lease expiration
- Artifact size limits
- Event audit logs
- Human approval gates
- Explicit permission for destructive actions

ACP should not grant filesystem, shell, GitHub, or cloud permissions by itself. It only represents coordination state.

---

## 20. Relationship to MCP

MCP standardizes:

```text
AI application <-> external tools/resources
```

ACP standardizes:

```text
software worker <-> shared workspace coordination state
```

They are complementary.

An agent may use MCP tools while reporting its work through ACP.

---

## 21. Reference MVP Roadmap

### v0.1

- Local ACP host
- HTTP API
- SSE event stream
- Work units
- Workers
- Leases
- Artifacts
- Checkpoints
- Reviews
- CLI

### v0.2

- JSON-RPC transport
- Git worktree integration
- GitHub PR artifacts
- Claude Code adapter
- Codex adapter

### v0.3

- Tauri desktop client
- Multi-repo support
- Human review UI
- Agent status dashboard

### v1.0

- Stable spec
- Cloud sync
- Organization workspaces
- Permission model
- SDKs
- Public registry of adapters

---

## 22. Example CLI

```bash
acp init
acp workspace add .
acp work create "Fix login redirect bug"
acp work claim work_123 --worker claude
acp lease request work_123 file://src/auth/callback.ts
acp checkpoint create work_123 --summary "Found async redirect issue"
acp artifact create work_123 --kind patch --file fix.patch
acp review request work_123 --reviewer human_chris
acp review cancel review_123
acp events stream
```

---

## 23. Open Questions

1. Should leases be advisory or enforced?
2. Should memory be part of the protocol or remain an implementation detail?
3. Should ACP define Git-specific extensions?
4. Should reviews support signed approvals?
5. Should artifacts be stored by the host or referenced externally?
6. Should ACP use JSON-RPC as the default transport like MCP?
7. Should protocol objects support CRDT-style sync for offline agents?

---

## 24. One-Sentence Pitch

ACP is a shared workspace protocol that lets AI coding agents and humans coordinate software work through tasks, leases, checkpoints, artifacts, reviews, and events.


---

## 25. Protocol Naming

Version: 0.1.0 Draft

> ACP is a vendor-neutral protocol for coordinating autonomous software engineering agents, shared workspace state, artifacts, checkpoints, reviews, and execution lifecycle.

### Naming Rule

**Official name:** Agent Coordination Protocol

**Abbreviation:** ACP

All specifications, SDKs, reference implementations, and documentation MUST use the name **Agent Coordination Protocol (ACP)**.

Products may state:

- Implements Agent Coordination Protocol (ACP)
- ACP Compatible

Product names and company branding MUST remain separate from the protocol itself.

---

> NOTE: This document supersedes previous drafts that referred to Hadoof, AWP, or other temporary names. The canonical protocol name is **Agent Coordination Protocol (ACP)**.
