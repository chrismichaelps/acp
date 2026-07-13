---
type: reference
status: PROVEN
date: 2026-07-12
tags: [reference, dogfood, agents, docker, production]
aliases: [live-agent-docker-dogfood]
---

# Live-Agent Docker Dogfood

## Purpose

Define the operator-driven `acp-self` production audit that proves real agents
can use ACP as their coordination system while inspecting ACP itself. This
complements deterministic scripted dogfood; it does not replace it.

## Interface

```bash
pnpm dogfood:docker-self
```

The command proves the production image and deterministic protocol surface. An
operator then starts the same image as a durable `acp-self` coordination host
and launches real agents directly, following [[ADR-0012-acp-self-agent-audit]].
There is no model-provider runner in the repository.

## Algorithm

1. Build and prove the ordinary production image with `dogfood:docker-self`.
2. Start that image with durable SQLite, bootstrap an `acp-self` workspace, then
   restart with bearer auth and workspace bindings required.
3. Initialize distinct planner, worker, and reviewer sessions using least
   privilege and load `ACP-SKILL.md` into each real agent's task.
4. Have the planner register bounded repository-audit work. Workers claim before
   inspection, lease before edits, and operate only in isolated worktrees.
5. Require checkpoints, nonempty handoff memories, independent review decisions,
   terminal work states, released leases, and repository validation.
6. Reconcile API-visible state and durable events. Record every concrete bug or
   gap; project accepted fixes from wiki to code and exercise them against the
   live container.

## Role Contracts

- **Planner:** inspect read-only, create bounded evidence-backed repository work,
  and avoid implementation or review actions.
- **Workers:** claim before inspection, lease before editing, update the wiki
  before implementation, validate, checkpoint, write nonempty handoff memory,
  request review, react to requested changes, complete approved work, and
  release every lease.
- **Reviewer:** inspect ACP memory plus exact worktree diffs, record concrete
  comments and durable findings, request changes when claims exceed evidence,
  resolve addressed comments, and approve only independently revalidated work.

The first implementation slice landed the two-task executable fixture,
rerun-safe setup, explicit contention-probe role instructions, workspace-bound
session commands, and strict planner/worker/reviewer result schemas.

The second implementation slice replaced the permissive prototype verifier with
a pure, unit-tested invariant engine and a strict adapter. Empty memory, unfinished
work, missing contention, event-store drift, or failed fixture behavior now fail
the report; the adapter also requires exact reviewer-inspected memory ids and
distinct durable role actors.

These fixture contracts remain reusable acceptance oracles, but they are not a
new package command. The active lane uses the Dockerized ACP product directly to
coordinate repository audit work.

The first production `acp-self` audit completed three work units and 190 durable
events. It found a Compose name collision, incomplete worker bootstrap scopes,
and incomplete reviewer guidance; the independent reviewer rejected two initial
submissions for false-positive daemon evidence and undisclosed coarse authority,
then rejected an ADR number collision during integration. All findings were
corrected, approved, completed, and exercised through the integrated production
Docker self-dogfood gate.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add a provider-runner script and call the wrapper the product proof.
- ❌ Do NOT count a scripted actor fixture as a model-backed agent.
- ❌ Do NOT pass provider credentials or the Docker socket into ACP.
- ❌ Do NOT allow agents to edit the ACP developer worktree.
- ❌ Do NOT accept metadata-only success when fixture behavior fails.
- ❌ Do NOT accept empty memory as a successful handoff.
- ❌ Do NOT infer contention from prompt prose; create a deterministic guard.
- ❌ Do NOT hide timeouts, role failures, or retries from `report.json`.

## Grill Log

- **Q:** Does the ACP container launch agents? **A:** No. ACP is the coordination
  control plane; the operator launches real agents and ACP records their durable
  work. _Rejected:_ model-host responsibilities in the server image and a new
  provider-runner script.
- **Q:** Should model dogfood block every PR? **A:** No. Keep deterministic Docker
  self-dogfood mandatory and run this lane manually/scheduled with credentials.
  _Rejected:_ flaky/costly merge requirements.
- **Q:** Why audit isolated ACP worktrees? **A:** They exercise the real
  repository without allowing concurrent agents to mutate the user's active
  checkout. _Rejected:_ fixture-only evidence and shared active-worktree writes.

## Referenced by

[[ADR-0012-acp-self-agent-audit]] ·
[[codex-dogfood-production-testing]] · [[references/_MOC]] · [[00-INDEX]]
