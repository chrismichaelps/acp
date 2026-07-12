---
type: reference
status: IMPLEMENTING
date: 2026-07-12
tags: [reference, dogfood, agents, docker, production]
aliases: [live-agent-docker-dogfood]
---

# Live-Agent Docker Dogfood

## Purpose

Define the turnkey, model-backed production lane that proves real agents can use
ACP as their coordination system. This complements deterministic scripted
dogfood; it does not replace it.

## Interface

```bash
pnpm dogfood:docker-agents
```

Optional configuration is defined by
[[ADR-0011-live-agent-docker-dogfood-runner]]. The default adapter launches the
installed Codex CLI. The command is intentionally not part of ordinary Local
Gates or required pull-request CI.

## Algorithm

1. Run repository preflights and build the production image unless explicitly
   reusing a trusted local image.
2. Create a run-scoped directory, git fixture, SQLite volume, transcript folder,
   and structured-result schemas.
3. Start ACP in bootstrap mode, create the fixture workspace, stop it, then
   restart the same volume with bearer auth and workspace bindings required.
4. Launch the planner model first. It initializes a bound session and creates
   exactly the two specified work units.
5. Acquire a harness-owned lease on the shared probe file. Launch two worker
   models and one reviewer model concurrently. Each worker must observe the probe
   lease conflict before selecting and completing real work. The reviewer polls,
   reads handoff memory, requests changes at least once, and later approves.
6. Release the contention guard, wait for all supervised roles, and run the
   verifier through both the shipped CLI/API and the SQLite source of truth.
7. Execute fixture behavior tests and write `report.json`. Always remove Docker
   state; retain run evidence according to policy.

## Role Contracts

- **Planner:** create exactly two work items against the pre-provisioned
  workspace; no implementation or review actions.
- **Workers:** attempt the shared contention probe, claim open work, lease before
  editing, make real fixture changes, run tests, checkpoint, write nonempty
  handoff memory, request review, react to requested changes, complete approved
  work, and release leases.
- **Reviewer:** inspect memory before each decision, request changes on at least
  one initial review, approve a follow-up and other valid work, and report the
  exact memory ids inspected.

The first implementation slice has landed the two-task executable fixture,
rerun-safe setup, explicit contention-probe role instructions, workspace-bound
session commands, and strict planner/worker/reviewer result schemas. Verifier and
Docker/provider supervision remain the next projection steps.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT count a scripted actor fixture as a model-backed agent.
- ❌ Do NOT pass provider credentials or the Docker socket into ACP.
- ❌ Do NOT allow agents to edit the ACP developer worktree.
- ❌ Do NOT accept metadata-only success when fixture behavior fails.
- ❌ Do NOT accept empty memory as a successful handoff.
- ❌ Do NOT infer contention from prompt prose; create a deterministic guard.
- ❌ Do NOT hide timeouts, role failures, or retries from `report.json`.

## Grill Log

- **Q:** Does the ACP container launch agents? **A:** No. ACP is the coordination
  control plane; an external supervised runner launches provider processes.
  _Rejected:_ model-host responsibilities in the server image.
- **Q:** Should model dogfood block every PR? **A:** No. Keep deterministic Docker
  self-dogfood mandatory and run this lane manually/scheduled with credentials.
  _Rejected:_ flaky/costly merge requirements.
- **Q:** Why start with a fixture instead of ACP's own repository? **A:** The
  runner must first prove deterministic supervision, contention, review, handoff,
  and file correctness in an isolated known problem. The next slice can target an
  isolated ACP clone. _Rejected:_ debugging runner and product simultaneously.

## Referenced by

[[ADR-0011-live-agent-docker-dogfood-runner]] ·
[[codex-dogfood-production-testing]] · [[references/_MOC]] · [[00-INDEX]]
