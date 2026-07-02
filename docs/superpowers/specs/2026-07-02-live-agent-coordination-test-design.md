# Live Agent Coordination Test — Design

**Date:** 2026-07-02
**Status:** Approved for planning
**Author:** brainstormed with Claude

## Problem

The ACP v0.1 reference implementation is spec-conformance complete: full REST /
native RPC / JSON-RPC / WebSocket / stdio surfaces, in-memory and SQLite storage,
a thin `acp` CLI, and two dogfood scripts (`dogfood:codex`,
`dogfood:codex:multi`).

The dogfood scripts are **scripted fixtures**: they hardcode the exact sequence of
HTTP calls a planner/worker/reviewer *would* make. No independent, reasoning actor
ever decides to claim work, discovers it has lost a lease, or chooses a review
outcome. We have never observed ACP mediating coordination between actors whose
behavior is not predetermined.

**Goal:** prove that N genuinely independent, reasoning agents — given only a role,
a goal, and the shipped `acp` CLI — cooperate correctly through a live ACP host,
and that the coordination they produce is verifiable after the fact from the
durable event log.

## Non-Goals

- Building new transport surface (no MCP adapter). The test uses only what ships.
- Load/soak testing (thousands of events, throughput). Separate effort.
- Cross-vendor agents (Codex + Claude). Single agent runtime for this pass.
- Changing domain, storage, or protocol behavior. This is a test harness only.

## Key Decisions

### Interface: the shipped `acp` CLI over Bash

Agents coordinate by running `acp` CLI commands via their `Bash` tool, not through
a new MCP server or the native Effect RPC client.

Rationale:
- A proper test exercises the **real shipped surface**, not code written for the
  test. The CLI is the actual public entry point and a thin client over the real
  HTTP transport, so testing through it tests the whole stack as shipped.
- One coordination action = one `Bash` call with JSON output. This is the natural
  ergonomic for a reasoning CLI agent; no Effect knowledge required.
- It keeps the test about **coordination**, not integration glue.
- If the CLI proves awkward for an agent to drive, **that is a finding** that
  justifies building an MCP server later. Good tests produce findings.

### Actor runtime: real Claude Code subagents

The "agents" are Claude Code subagents spawned via the Agent tool. Each is given a
role, a goal, ground rules, and the CLI — **not a script of commands**. Ordering,
conflict resolution, and review outcomes are the agent's own decisions.

### Host configuration: durable + hardened

- One live `dist/app/server/main.js` process.
- **SQLite storage** (`ACP_STORAGE_ADAPTER=sqlite`, `ACP_SQLITE_PATH`) so state is
  durable and independently inspectable by the verifier.
- **Auth on** (`ACP_REQUIRE_AUTH=true`) so scoped bearer sessions are exercised
  like production. Each agent runs `session init` for its role's permissions and
  exports the returned id as `ACP_RPC_TOKEN`.

### Execution mode: staged first, concurrent as hard mode

- **Staged (primary, build first):** phases run in sequence (planner → workers
  claim+edit → reviewer decides → workers react). Each agent gets a small bounded
  poll budget against the event log. Unscripted decisions, repeatable mechanics.
- **Concurrent (hard mode, after staged passes):** Worker A, Worker B, and
  Reviewer spawned in one parallel burst, all polling the event log. Maximum
  realism; accepted flakiness risk from bounded subagent lifetimes.

Reason: staged is the reliable proper-test that proves the mechanics
deterministically; concurrent is the stress demo layered on top once mechanics
are trusted.

## Substrate

### Scratch work repo

A throwaway git repo (created under the scratchpad dir, not the ACP repo) with
2–3 genuinely independent tasks, so ACP claims/leases/checkpoints/artifacts map to
**real file edits**, not fictional ones. Example tasks:

- `task-a`: fix a bug in `src/util-a.js`
- `task-b`: add a helper in `src/util-b.js`
- `task-shared`: a change touching `src/shared.js` that **both workers want**,
  engineered so exactly one can hold the lease at a time → forces a real conflict.

The repo's `uri` becomes the ACP workspace URI; file paths become lease `uri`s.

## Actors and Behavior

Coordination between actors flows **through ACP's own event log** — agents poll
`acp events list --workspace <id> --after <seq>` with bounded backoff, exactly the
recovery path a real worker uses. The harness never passes messages between agents
directly.

### Planner
Bootstraps: `session init` (planner scope) → `workspace create` → `work create`
×3. Emits work ids for the workers to discover. Sequential setup phase.

### Worker A / Worker B
Given: their role, the workspace id, the scratch repo path, and the rule "claim
work, hold a lease on the file you edit, hand off your state, request review, then
react to the outcome." Each independently:
1. `session init` (worker scope), export token.
2. Discover open work (`work list` / `events list`).
3. **Race to claim** a unit (`work claim`) and request a lease on its file
   (`lease request`). On the shared file, one wins; the loser must observe the
   conflict and back off to a different unit — the central emergent behavior.
4. Make the real file edit in the scratch repo.
5. Write handoff state: `checkpoint create` + `memory create`.
6. `artifact pr` (register a PR-shaped artifact) + `work update --state` to a
   review-ready state.
7. `review request`.
8. **Poll** the event log for its review outcome; on `review.request_changes`,
   make a follow-up edit + second `checkpoint create`, then re-request/await
   approval; on approval, `lease release` + `work update` to terminal state.

### Reviewer
Given: "review requested work; approve good work, request changes on at least one."
Polls for review requests, reads the artifact (`artifact content`) and handoff
`memory list`, then decides: `review approve --met ...` for one, `review
request-changes` for another. Genuinely chooses outcomes.

## Verification (final phase)

Run by the main session plus a dedicated verifier agent, reading back **two
independent ways** — the API (`acp events list`) and the **SQLite file directly** —
and asserting:

1. Event `seq` is strictly monotonic and append-only across the whole workspace.
2. A real contention event occurred: a lease conflict or `work.claim` conflict
   where one worker was denied the shared resource.
3. The review loop is present: a `review.request_changes` followed later by a
   `review.approved` (or `review.cancelled`) for the same work unit.
4. Every claimed unit reached a terminal state and every acquired lease was
   released or revoked (no dangling holds).
5. Cross-actor handoff worked: a checkpoint/memory record written by one actor was
   read by another (evidenced by the reviewer's reads and, in the change-request
   loop, the worker resuming from its own checkpoint).
6. The SQLite readback matches the API readback (durability parity).

Any assertion failing is a reported finding, not a silent pass. Truncated coverage
(e.g. an agent that ran out of poll budget) is logged explicitly.

## Deliverables

- A harness/orchestration doc or script describing how the main session launches
  the host, creates the scratch repo, spawns the agents in staged order, and runs
  the verifier.
- Role prompt templates for planner / worker / reviewer (goal + rules + CLI, no
  command script).
- A verifier routine (assertions 1–6) usable from the main session.
- A short results write-up: what coordinated correctly, any CLI-ergonomics
  findings, and whether the concurrent hard-mode run held up.

## Risks

- **Subagent lifetime vs. review round-trip.** Mitigated by staged execution +
  bounded poll budgets; concurrent mode explicitly accepts the risk.
- **Non-determinism of reasoning agents.** Intended — the verifier asserts
  invariants (conflict happened, loop happened, terminal states reached), not exact
  sequences.
- **Scratch-repo edits are incidental.** Real edits exist to make leases/artifacts
  meaningful; correctness of the edits themselves is not asserted, only that
  coordination around them held.
