---
type: decision
status: ACCEPTED
date: 2026-07-12
tags: [adr, dogfood, agents, docker, testing, acp-self]
aliases: [ADR-0012, acp-self-agent-audit]
---

# ADR-0012 — ACP-Self Agent Audit

## Context

ACP must prove that real development agents can use the production Docker host
to discover and repair gaps in ACP itself. A new JavaScript provider runner
would mostly test orchestration code around ACP and could become dead code. The
repository already has the production `dogfood:docker-self` image, the `bin/acp`
client, [[agent-integration]], strict coordination evidence, and an established
`acp-self` workspace convention.

## Decision

Run the audit as an operator-driven, evidence-backed ACP session. Build and start
the ordinary production image, create an `acp-self` workspace for this repository,
and initialize real planner, worker, and reviewer sessions against that Docker
host. Agents load `ACP-SKILL.md`, coordinate only through ACP, inspect isolated
ACP worktrees, and report defects or documentation/code gaps as ACP work,
checkpoints, memories, reviews, and events.

No `dogfood:docker-agents` package command, provider adapter, or new orchestration
`.mjs` file is introduced. The operator may use shell commands and the existing
Docker/client surfaces to establish and observe the session. Any product defect
found is fixed through the normal wiki-first feature flow and must be exercised
through the live ACP host before acceptance.

## Execution Contract

1. Run repository preflights and build the production image through the existing
   `acp-self` path.
2. Start a durable SQLite-backed production ACP container with bearer auth and
   workspace binding enabled for agent execution.
3. Create the repository workspace during a bounded bootstrap step, restart the
   same state hardened, and initialize distinct bound agent sessions.
4. Give the planner a bounded audit objective. It creates work in ACP; workers
   claim work before inspecting isolated worktrees and use leases before edits.
5. Workers record checkpoints and nonempty handoff memory. The reviewer reads
   that evidence, records an independent verdict, and requests changes when
   proof is insufficient.
6. Reconcile durable events, terminal work state, released leases, and the
   repository validation gate. Record bugs and gaps even when no patch is
   required.

## Security and Isolation

- Provider credentials and the Docker socket stay outside ACP.
- ACP never launches the agents; it is their production coordination control
  plane.
- Agents inspect or edit only assigned isolated worktrees. The user's active
  worktree is not a concurrent write target.
- Every agent session is workspace-bound and least-privileged.
- Session tokens are not committed or copied into wiki evidence.

## Acceptance Evidence

- The ordinary production ACP image is the live coordination host.
- Distinct real agents appear in durable planner, worker, and reviewer events.
- The audit produces concrete findings tied to repository paths and validation.
- Completed work has checkpoint, nonempty memory, review, and released-lease
  evidence.
- Any accepted fix is documented first, implemented in the code path used by
  the container, validated, and exercised live; no disconnected harness is
  counted as product progress.

## Consequences

ACP is evaluated through the same surfaces developers and agents consume. The
procedure is intentionally operator-driven: it is a production audit session,
not another scripted test lane. Deterministic `pnpm dogfood:docker-self` remains
the repeatable CI gate, while periodic `acp-self` sessions expose usability,
coordination, documentation, and product gaps that scripted scenarios miss.

## Referenced by

[[live-agent-docker-dogfood]] · [[agent-integration]] · [[architecture/_MOC]] ·
[[decisions/_MOC]] · [[ADR-0018-recovery-review-quickstart]] ·
[[recovery-review-quickstart]]
