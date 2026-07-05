---
name: acp
description: 'How an autonomous worker (agent, bot, CI, or human) interacts with an Agent Coordination Protocol (ACP) host to coordinate work in a shared software workspace without a shared conversation. Use when: an agent needs to register, discover or create work, claim it, lease files before editing, checkpoint recoverable progress, hand off via memory, attach artifacts, request/handle review, complete work, or recover after a crash by replaying events. Triggers: coordinating multiple agents in one repo, driving the acp CLI, avoiding edit collisions, resuming interrupted work, or integrating a client against an ACP host.'
---

# ACP Skill — Interacting with the Agent Coordination Protocol

**You are a worker sharing a workspace with other autonomous workers.** You do
**not** coordinate by talking to them. You read and write durable ACP protocol
state; every mutation appends a monotonic event, so any worker can replay history
and catch up before acting. This file tells you exactly how to interact with an
ACP host.

> Canonical source: [`wiki/references/agent-integration.md`](./wiki/references/agent-integration.md).
> Every command below was validated live against the Dockerized host.

## Mental model

| Concept        | Your use of it                                                           |
| -------------- | ------------------------------------------------------------------------ |
| **Workspace**  | The shared context you operate in (a repo, worktree, container, CI job). |
| **Worker**     | Your own registered identity and status.                                 |
| **Work unit**  | A task with an explicit lifecycle state machine you drive.               |
| **Lease**      | An advisory, TTL'd claim you take on a file **before** editing it.       |
| **Checkpoint** | A resumable snapshot you write so a crash or handoff survives.           |
| **Memory**     | Append-only facts you leave for the next actor (it can't see your chat). |
| **Artifact**   | A preserved output (PR, diff, file) you attach to the work.              |
| **Review**     | The gate you request and a reviewer resolves.                            |
| **Event**      | The append-only per-workspace log you replay to recover.                 |

## 1. Connect to a host

**Recommended — Dockerized daily driver.** The host runs as a container; the
`bin/acp` wrapper runs the CLI inside it. The default `local` profile has auth
off, so no token is needed and your mutations attribute to `worker_system`.

```bash
npm run acp:up                       # docker compose --profile sqlite up -d --build
ln -s "$(pwd)/bin/acp" /usr/local/bin/acp
acp workspace list                   # runs inside the container
```

**Alternative — direct HTTP.** The CLI is a thin REST client; point it at a
running host. `acp` below is shorthand for `node dist/app/cli/main.js`.

```bash
export ACP_BASE_URL=http://localhost:4317
acp workspace list
```

If the host has `ACP_REQUIRE_AUTH=true`, bootstrap a session first (see
[Authentication](#authentication)) and export `ACP_RPC_TOKEN`.

## 2. Run the operating loop

This is the exact sequence you follow. Every command is real and verified.

```bash
# (auth-on hosts only) register yourself and capture the bearer token.
acp session init --worker agent_codex --name Codex --kind agent \
  --permissions workspace:read,workspace:write,work:create,lease:create,review:request

# Discover open work — or open your own.
acp work list --workspace workspace_xxx
acp work create "Fix login redirect" --workspace workspace_xxx --priority high

# Claim it (open -> claimed), then LEASE every file you will edit.
acp work claim work_xxx --worker agent_codex
acp lease request --workspace workspace_xxx --holder agent_codex \
  --kind file --uri "file:///repo/src/login.ts" --ttl 300
#   -> another worker requesting the same lease gets 409 lease_conflict.

# Go running and record recoverable state as you work.
acp work update work_xxx --state running
acp checkpoint create --workspace workspace_xxx --work work_xxx \
  --summary "patched redirect, tests green"
acp memory create --workspace workspace_xxx --work work_xxx \
  --kind handoff --key login-fix --summary "done" --content "notes for the reviewer"

# Attach your output and request review (performs running -> needs_review).
acp artifact pr --workspace workspace_xxx --work work_xxx \
  --url "https://github.com/org/repo/pull/42" --summary "Fix login redirect"
acp review request --work work_xxx --by agent_codex

# On approval, finish and release every lease.
acp review approve review_xxx --met "correctness"   # a reviewer does this
acp work update work_xxx --state completed
acp lease release lease_xxx

# Recover after any restart BEFORE acting: replay, then subscribe.
acp events list --workspace workspace_xxx --after 0
acp events stream --workspace workspace_xxx
```

If a review returns **changes_requested**, go back to `running`, write a fresh
checkpoint, and re-request review.

## 3. Work lifecycle

Illegal jumps return `invalid_state_transition` (HTTP 409).

```
open ─▶ claimed ─▶ running ─▶ needs_review ─▶ approved ─▶ completed
                      ▲            │
                      └── changes_requested ◀┘
```

`blocked`, `rejected`, `cancelled` are the other terminal/holding states.
`review request` is the only path that performs `running → needs_review`.

## 4. Full command surface

```
session    init      --worker <id> --name <n> [--kind <k>] [--vendor <v>] [--capabilities <csv>] [--permissions <csv>]
worker     list | get <worker_id>
workspace  create --name <n> --kind <k> --uri <u> [--default-branch <b>] | update <id> | archive <id> | list
work       create <title> --workspace <id> [--priority <p>] [--description <d>]
work       list --workspace <id> | get <id> | claim <id> --worker <id> | update <id> --state <state>
lease      request --workspace <id> --holder <id> --kind <k> --uri <u> [--ttl <n>]
lease      list --workspace <id> | renew <id> [--ttl <n>] | revoke <id> | release <id>
checkpoint create --workspace <id> --work <id> --summary <s> | list --work <id>|--workspace <id> | latest --work <id>
artifact   create --workspace <id> --work <id> --kind <k> [--uri <u>] [--summary <s>] [--content <c>]
artifact   pr --workspace <id> --work <id> --url <u> [--summary <s>] | update <id> | list | content <id> | delete <id>
review     request --work <id> --by <id> [--reviewer <id>] | list --work <id>|--workspace <id>
review     approve <id> --met <csv> [--signature <s> --signature-algorithm <alg> --signature-key <key-id> [--signed-at <iso>]]
review     reject <id> | request-changes <id> | cancel <id>
memory     create --workspace <id> --kind <k> --key <k> --summary <s> --content <c> [--work <id>] [--labels <csv>]
memory     list --workspace <id> [--after <seq>] [--limit <n>] [--work <id>] [--kind <k>] [--key <k>] [--label <l>]
events     list --workspace <id> [--after <seq>] | stream --workspace <id>
```

`workspace kind` ∈ `git_repository | git_worktree | directory | container |
cloud_sandbox | ci_job`. Every command prints JSON on stdout.

## 5. Errors you must handle

Failures are `{"error":{"code":...,"message":...}}`.

| Code                       | HTTP | When                         | What you do                                        |
| -------------------------- | ---- | ---------------------------- | -------------------------------------------------- |
| `lease_conflict`           | 409  | Resource already leased.     | Back off, wait/retry, or coordinate — never force. |
| `invalid_state_transition` | 409  | Illegal work-state jump.     | Re-read `work get`; take only legal transitions.   |
| `unauthorized`             | 401  | Missing/invalid credentials. | Bootstrap or refresh your session token.           |
| `forbidden`                | 403  | Token lacks the scope.       | Get a session with the needed permission.          |
| `not_found`                | 404  | Unknown id.                  | Re-list to resolve a current id.                   |

`conflict` and `rate_limited` are reserved with no current producer — don't
depend on them.

## 6. Rules of the road

- **Lease before you edit.** Leases are advisory (they don't lock the FS), but a
  `lease_conflict` means another worker owns that file — respect it.
- **Replay before you act.** After any restart, `events list --after <seq>` is
  the recovery contract. Never act on stale in-process state.
- **Leave handoff memory.** The next actor cannot see your conversation;
  `memory create --kind handoff` is how context crosses the boundary.
- **Don't forge lifecycle events.** You may publish only `work.progressed`;
  lifecycle transitions come from the state machine via the proper commands.
- **Release what you claim.** Complete work and release every lease so the
  workspace ends with no dangling claims.

## Authentication

Local mode allows unauthenticated requests. On `ACP_REQUIRE_AUTH=true` hosts:

- `session init` is the open bootstrap route; it returns the `session_id` used as
  the bearer token on later calls.
- Permissions are explicit strings — `work:create`, `lease:create`,
  `review:approve`, `event:read`, …
- The CLI and stdio bridge forward `ACP_RPC_TOKEN`, so you can
  `export ACP_RPC_TOKEN=$(...)` once and reuse the scoped session.

## Transports

The CLI speaks **REST** (`/v1/...`), the primary surface. First-party TypeScript
clients may use **Native RPC** (`/rpc/native`, NDJSON, `@effect/rpc`) — one path
for unary calls and `events.subscribe` streaming. **JSON-RPC** (`POST /rpc`, WS
`GET /rpc`) is the compatibility surface, and `acp-jsonrpc-stdio` bridges
Content-Length framed JSON-RPC for stdio integrations. See
[`README.md`](./README.md) for deployment and storage, and
[`wiki/references/agent-integration.md`](./wiki/references/agent-integration.md)
for the canonical version of this skill.
