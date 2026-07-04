# Agent Coordination Protocol (ACP)

**ACP is a coordination layer for autonomous software workers that share an
engineering workspace.** It defines the durable facts — who is working, what work
exists, which resources are claimed, what progress is recoverable, and what still
needs human review — that let independent agents cooperate without a shared
conversation or shared memory.

ACP deliberately says nothing about _how_ an agent reasons, edits files, calls a
model, or talks to a human. It only defines the workspace state that makes
cooperation safe: state, ownership, recovery, and review.

This repository is the **TypeScript reference implementation of ACP v0.1**. It is
suitable for protocol design, adapter development, and local integration
experiments — not yet a production coordination server.

> **Status:** v0.1, in active development. The full protocol surface is
> implemented and spec-conformant across every transport, but distribution and
> operational hardening are still in progress.

---

## Why ACP

Multiple agents in one repo step on each other: two workers edit the same file, a
crashed agent loses its progress, a reviewer can't tell what an agent actually
did. Conversational memory doesn't survive a process restart and can't be shared
between two different agents.

ACP moves those facts _out_ of any single agent and into durable, replayable
protocol state:

| Concept        | What it gives you                                                        |
| -------------- | ------------------------------------------------------------------------ |
| **Workspace**  | The shared context (a repo, worktree, directory, container, CI job).     |
| **Worker**     | A registered actor (agent, bot, human, CI) with an identity and status.  |
| **Work unit**  | A task with an explicit lifecycle state machine.                         |
| **Lease**      | An advisory, TTL'd claim on a resource (e.g. a file) — prevents clashes. |
| **Checkpoint** | A resumable snapshot of partial progress, so a handoff survives a crash. |
| **Memory**     | Append-only, workspace-scoped facts for handoff between actors.          |
| **Artifact**   | A preserved output (a PR, a diff, a file) tied to a work unit.           |
| **Review**     | A gate for human (or agent) decisions on a work unit.                    |
| **Event**      | The append-only, per-workspace history of everything above.              |

Every mutation appends a monotonic event, so a recovering worker can replay
history and catch up before it acts.

---

## Quickstart

Requirements: Node (current LTS or newer — the SQLite adapter uses the built-in
`node:sqlite`), and `pnpm` for dependency install.

```bash
pnpm install
pnpm build          # tsc -> dist/
```

### 1. Run a host

```bash
# In-memory storage, no auth — the simplest local path.
ACP_PORT=4317 node dist/app/server/main.js
```

For durable state, use SQLite (same protocol behavior, different adapter):

```bash
ACP_STORAGE_ADAPTER=sqlite ACP_SQLITE_PATH=.acp/acp.sqlite \
  ACP_PORT=4317 node dist/app/server/main.js
```

### 2. Drive it with the CLI

The `acp` CLI is a thin HTTP client of the running host. Point it at the host with
`ACP_BASE_URL` (it defaults to `http://localhost:$ACP_PORT`). All commands print
JSON on stdout. Below, `acp` is shorthand for `node dist/app/cli/main.js`.

```bash
export ACP_BASE_URL=http://localhost:4317

# Register a session (returns a session_id used as a bearer token when auth is on).
acp session init --worker agent_codex --name Codex --kind agent \
  --permissions workspace:read,workspace:write,work:create

# Create a workspace (kind is one of: git_repository, git_worktree, directory,
# container, cloud_sandbox, ci_job).
acp workspace create --name my-repo --kind git_repository \
  --uri "file:///path/to/repo" --default-branch main
# -> { "id": "workspace_...", ... }

# Create work in that workspace.
acp work create "Fix login redirect" --workspace workspace_xxx --priority high
# -> { "id": "work_...", "state": "open", ... }
```

### 3. A full worker lifecycle

This is the sequence a real worker follows — claim, protect the resource, record
progress, get reviewed, finish. It is exactly what the live-agent test harness
(below) exercises with autonomous agents.

```bash
# Claim the work and lease the file you're about to edit.
acp work claim work_xxx --worker agent_codex
acp lease request --workspace workspace_xxx --holder agent_codex \
  --kind file --uri "file:///path/to/repo/src/login.ts" --ttl 300
#   -> a second worker requesting the same lease gets 409 lease_conflict.

# Move into progress and record recoverable state.
acp work update work_xxx --state running
acp checkpoint create --workspace workspace_xxx --work work_xxx \
  --summary "patched redirect target, tests green"
acp memory create --workspace workspace_xxx --work work_xxx \
  --kind handoff --key login-fix --summary "done" --content "details for the reviewer"

# Register the output and request review.
acp artifact pr --workspace workspace_xxx --work work_xxx \
  --url "https://github.com/org/repo/pull/42" --summary "Fix login redirect"
acp review request --work work_xxx --by agent_codex   # performs running -> needs_review

# ...reviewer approves (see below)... then finish and release.
acp work update work_xxx --state completed
acp lease release lease_xxx
```

### 4. Review and replay

```bash
# A reviewer session.
acp session init --worker agent_reviewer --name Reviewer --kind agent \
  --permissions workspace:read,event:read,memory:read,review:approve,review:request_changes
acp review list --workspace workspace_xxx
acp review request-changes review_xxx             # -> work goes to changes_requested
acp review approve review_xxx --met "correctness" # -> work goes to approved

# Replay the full history, or stream live.
acp events list --workspace workspace_xxx --after 0
acp events stream --workspace workspace_xxx
```

---

## Core concepts

### Work lifecycle

Work units move through an explicit state machine. Illegal jumps return
`invalid_state_transition` (HTTP 409).

```
open ─▶ claimed ─▶ running ─▶ needs_review ─▶ approved ─▶ completed
                      ▲            │
                      └── changes_requested ◀┘
```

`review request` is what performs `running -> needs_review`; a reviewer's
`request-changes` moves the work to `changes_requested`, from which the worker
returns to `running`, writes a new checkpoint, and re-requests review. `blocked`,
`rejected`, and `cancelled` are the other terminal/holding states.

### Leases

A lease is an **advisory** TTL'd claim on a resource identified by `kind` + `uri`.
Requesting a lease already held by another worker returns `409 lease_conflict`.
Long-running work can `renew` a lease; a supervisor can `revoke` a stale one; and
workspace lease state is inspectable with `lease list`. Leases coordinate; they do
not lock the filesystem.

### Reviews

A review gates a decision on a work unit. Cancellation is its own lifecycle event
(`review.cancelled`), distinct from rejection: cancelling a requested review
withdraws the gate and lets the work continue, rather than failing it.

### Events

Every workspace has an append-only, strictly monotonic event log
(`workspace_id, seq`). It is the source of truth for ordering and the recovery
mechanism: a returning worker replays `events list --after <seq>` before opening a
live subscription. Worker presence, by contrast, is host-scoped current state
(`worker list` / `worker get`), not derived from event history.

---

## Transports

Every transport runs against the **same** application graph, so sessions,
workspaces, leases, events, memory, checkpoints, artifacts, and reviews are shared
regardless of how a client connects.

| Transport           | Endpoint / entry           | Use it for                                             |
| ------------------- | -------------------------- | ------------------------------------------------------ |
| **REST**            | `/v1/...`                  | The primary HTTP surface; what the CLI speaks.         |
| **SSE**             | `GET /v1/events/stream`    | Workspace-scoped live events over HTTP.                |
| **Native RPC**      | `/rpc/native` (NDJSON)     | First-party TypeScript clients using `@effect/rpc`.    |
| **JSON-RPC (POST)** | `POST /rpc`                | Compatibility; 2.0 envelopes, batch, notifications.    |
| **JSON-RPC (WS)**   | `GET /rpc` (upgrade)       | The same JSON-RPC surface over a persistent socket.    |
| **stdio bridge**    | `acp-jsonrpc-stdio` binary | Content-Length framed JSON-RPC for stdio integrations. |

**Native RPC** is the recommended path for new first-party TypeScript consumers:
it mounts the generated `@effect/rpc` contract with NDJSON framing so unary calls
and `events.subscribe` streaming share one path, and every operation carries
structured Effect telemetry (operation, outcome, duration, client id, ACP error
code). **JSON-RPC** is the compatibility surface — every REST mutation has a paired
method — rather than the focus of new client work. On the WebSocket, a single
`events.subscribe` request delivers later workspace events as `events.event`
notifications; the bearer token comes from the `Authorization` handshake header or
a `?token=` query parameter for browsers that can't set handshake headers.

---

## Operations

For container hosts (Railway, Fly.io, Render, Kubernetes), two unauthenticated
probes report host health — no bearer token, so they answer before any session
exists:

| Probe         | Endpoint      | Meaning                                                                                                       |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| **Liveness**  | `GET /health` | `200` while the process serves; makes no backend calls.                                                       |
| **Readiness** | `GET /ready`  | `200` when the storage backend answers, `503` when it is unreachable so the load balancer drains the replica. |

A passing `/health` with a failing `/ready` distinguishes "process alive" from
"dependencies reachable". Point your platform's health check at `/ready`.

### Deploying

The host is a single long-lived process, so it runs on any **persistent container
platform** (Railway, Fly.io, Render, a VM, Kubernetes) — not serverless. A
multi-stage [`Dockerfile`](./Dockerfile) builds a non-root image whose
`HEALTHCHECK` targets `/ready`:

```bash
docker build -t acp .
docker run -p 4317:4317 acp
```

The runtime image also contains the compiled `acp` CLI. In a running container,
the CLI can target the host over loopback, which is useful for smoke testing a
deployment with the same binary users will operate later:

```bash
docker exec -e ACP_BASE_URL=http://127.0.0.1:4317 <container> \
  node dist/app/cli/main.js session init \
  --worker agent_ops --name "Ops Agent" \
  --capabilities can_edit_files,supports_checkpoints \
  --permissions workspace:read,workspace:write,work:create,event:read
```

That path is not a synthetic health check. It exercises the HTTP router, schema
decoding, session issuance, permission vocabulary, state machine, event log, and
CLI request builder from inside the production image. A realistic validation run
should create a workspace, open and claim work, move it to `running`, write a
checkpoint or memory record, request review, approve it, complete the work, and
replay `events list` for the workspace before promoting the image.

The same image runs every deployment profile; only environment differs. See
[`wiki/references/deployment.md`](./wiki/references/deployment.md) for the
platform-by-platform runbook and storage-adapter guidance.

---

## Storage

Storage is selected at the host boundary behind a single port, so persistence is
an adapter concern, not a protocol concern.

- **In-memory** (default) — deterministic, simple, ephemeral. Good for the local
  happy path and tests.
- **SQLite** (`ACP_STORAGE_ADAPTER=sqlite`, `ACP_SQLITE_PATH=...`) — durable state
  and an append-only event table, created on startup. Preserves append order and
  keeps queries scoped by workspace and key prefix.
- **Postgres** (`ACP_STORAGE_ADAPTER=postgres`, `ACP_DATABASE_URL=...`) — the
  network-durable adapter (via `@effect/sql-pg`, with connection pooling and
  migrations run on startup) for multi-replica / managed hosting. Per-workspace
  event `seq` is allocated atomically, so concurrent writers across processes
  never collide. The host fails fast at boot if `ACP_DATABASE_URL` is unset.
  Background lease/session sweeping is guarded by a Postgres advisory lock in
  this mode, so replicated hosts do not emit duplicate lease-expiry events.

Live event fan-out is selected separately. `ACP_EVENT_BROKER=in-process` is the
default single-node broker; `ACP_EVENT_BROKER=pg-notify` uses the same Postgres
connection string to deliver SSE/WebSocket event notifications across replicas
while replay remains backed by durable storage.

---

## Authentication and scopes

Local mode allows unauthenticated requests. Set `ACP_REQUIRE_AUTH=true` to require
bearer sessions on scoped routes.

- `session.initialize` is the open bootstrap route; it mints the session id used
  as the bearer token on later calls.
- Session ids are opaque, high-entropy credentials (not counters or timestamps).
- Permissions are explicit strings — `work:create`, `lease:create`,
  `artifact:delete`, `review:approve`, `event:read`, and so on.
- Missing/invalid credentials return `401 Unauthorized`; a valid token lacking the
  required scope returns `403 Forbidden` with the `forbidden` error code.

The CLI and stdio bridge both forward `ACP_RPC_TOKEN` as the bearer token, so an
integration can `export ACP_RPC_TOKEN=$(...)` once and reuse the scoped session
without ACP storing any credentials.

---

## Configuration

`.env.example` is the drift-checked runtime manifest for the host, CLI, stdio
bridge, and scripts. Copy it for local use; inject secrets from the operator shell
rather than committing them.

| Variable                         | Purpose                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `ACP_PORT`                       | Host bind port (default `4317`).                                               |
| `ACP_BASE_URL`                   | Target host for the CLI / stdio bridge.                                        |
| `ACP_PROFILE`                    | Optional deployment preset (`local`, `single-node`, `hosted`, `self-host-ha`). |
| `ACP_STORAGE_ADAPTER`            | `memory` (default), `sqlite`, or `postgres`.                                   |
| `ACP_SQLITE_PATH`                | SQLite database path (required for the sqlite adapter).                        |
| `ACP_DATABASE_URL`               | Postgres connection string for postgres-backed adapters.                       |
| `ACP_EVENT_BROKER`               | `in-process` (default) or `pg-notify`.                                         |
| `ACP_REQUIRE_AUTH`               | `true` to require bearer sessions on scoped routes.                            |
| `ACP_REQUIRE_WORKSPACE_BINDINGS` | `true` to require `workspace_ids` during session initialization.               |
| `ACP_RPC_TOKEN`                  | Bearer token forwarded by the CLI / stdio bridge.                              |
| `ACP_LOG_LEVEL`                  | `debug` \| `info` (default) \| `warn` \| `error`.                              |
| `ACP_DEFAULT_LEASE_TTL`          | Default lease TTL when a request omits one.                                    |
| `ACP_SESSION_TTL`                | Session lifetime.                                                              |
| `ACP_SWEEP_INTERVAL`             | Background sweeper cadence (expiring leases/sessions).                         |
| `ACP_SSE_HEARTBEAT`              | SSE keepalive interval.                                                        |
| `ACP_EVENT_RETENTION_DAYS`       | Event history retention window.                                                |
| `ACP_MAX_ARTIFACT_SIZE_MB`       | Inline artifact content size cap.                                              |

---

## CLI command reference

```
session init      --worker <id> --name <n> [--kind <k>] [--vendor <v>] [--capabilities <csv>] [--permissions <csv>]
worker  list | get <worker_id>
workspace create | update <id> | archive <id> | list
work    create <title> --workspace <id> [--priority <p>] [--description <d>]
work    list --workspace <id> | get <id> | claim <id> --worker <id> | update <id> --state <state>
lease   request --workspace <id> --holder <id> --kind <k> --uri <u> [--ttl <n>]
lease   list --workspace <id> | renew <id> [--ttl <n>] | revoke <id> | release <id>
checkpoint create --workspace <id> --work <id> --summary <s> | list | latest --work <id>
artifact create | pr | update <id> | list | content <id> | delete <id>
review  request --work <id> --by <id> | list | approve <id> --met <csv> | reject <id> | request-changes <id> | cancel <id>
memory  create --workspace <id> --kind <k> --key <k> --summary <s> --content <c> [--work <id>] [--labels <csv>]
memory  list --workspace <id> [--after <seq>] [--limit <n>] [--work <id>] [--kind <k>] [--key <k>] [--label <l>]
events  list --workspace <id> [--after <seq>] | stream --workspace <id>
```

Run `node dist/app/cli/main.js` with no arguments to print the full usage text.

---

## Testing and dogfooding

The verification path is TypeScript typechecking, ESLint, and the full Vitest
suite:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

(The SQLite adapter prints Node's experimental-`node:sqlite` warning during
storage tests; that is expected, not a failure.)

Beyond unit tests, three lanes exercise ACP against a _live_ host:

- **`pnpm dogfood:codex`** — a single Codex-shaped worker runs a full lifecycle
  (session, claim, lease, checkpoint, memory, PR artifact, progress, review,
  release, complete, replay) against a running host.
- **`pnpm dogfood:codex:multi`** — separate planner/worker/reviewer sessions prove
  ACP can serialize a claim race, report a lease conflict, preserve handoff state,
  run a request-changes loop, and replay a monotonic history.
- **`scripts/live-test/`** — the real-agent coordination harness: genuinely
  autonomous agents (planner / two workers / reviewer), each given only a role and
  the `acp` CLI, coordinate through a live SQLite-backed, auth-on host. A verifier
  then asserts six invariants — monotonic append-only event seq, real lease
  contention, a request-changes→approve review loop, terminal states with no
  dangling leases, cross-actor handoff, and API↔SQLite durability parity — reading
  the history back both via the CLI and directly from the database file. See
  `docs/superpowers/specs/2026-07-02-live-agent-coordination-test-design.md`.

For hosted-policy dogfood, set `ACP_DOGFOOD_WORKSPACE_ID` to a provisioned
workspace id. The Codex smoke and multi-agent runners will bind every session to
that workspace and skip local workspace creation, which lets the same scripts run
against hosts with `ACP_REQUIRE_WORKSPACE_BINDINGS=true`.

The package also exposes an `acp-jsonrpc-stdio` binary that reads Content-Length
framed JSON-RPC from stdin, forwards it to the host's `POST /rpc`, and writes
framed responses to stdout.

---

## Repository layout

```
src/
  protocol/schema   Wire-surface schemas
  protocol/errors   Tagged protocol errors
  domain/           Behavior per ACP concept (work, leases, reviews, events, ...)
  infrastructure/   Storage seam (memory + sqlite), HTTP/JSON-RPC/RPC, SSE, node adapters
  app/              Entrypoints: app-live (host graph), server, stdio, cli
scripts/            Dogfood + live-test harnesses
wiki/               Canonical, wiki-first design record
specs.md            Working draft of the protocol
```

## Design record

The repository is governed **wiki-first**: the canonical design record lives under
`wiki/`, not in scattered comments. `wiki/00-INDEX.md` is the front door,
`wiki/architecture/_MOC.md` tracks layer topology and build order,
`wiki/CHANGELOG.md` records each logic slice, and `wiki/src/` mirrors `src/`
one-for-one. `specs.md` is the working protocol draft; the wiki records how each
implementation slice interprets it. The architecture follows
`wiki/decisions/ADR-0001-architecture-foundation.md`: Effect Layers compose the
runtime, Storage and Transport are explicit seams, and schemas define the wire
surface.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
