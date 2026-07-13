---
date: 2026-07-12
topic: live-agent-docker-dogfood
from_role: Architect
to_role: Shadow
status: COMPLETE
maturity: PROVEN
tags: [handoff, dogfood, agents, docker]
---

# Handoff — Live-Agent Docker Dogfood

## Done

- Audited all existing dogfood lanes. Mandatory Docker, HA, CLI, transport, and
  GitHub sandbox lanes are scripted; none launches a model process.
- Confirmed `scripts/live-test/` is a manual native-host recipe with a stale
  missing design link and no command/workflow wiring.
- Identified verifier false positives and coverage gaps: empty memory passes,
  contention is not deterministic, actual file behavior is unchecked, not all
  created work must finish, and workspace binding is disabled.
- Accepted [[ADR-0011-live-agent-docker-dogfood-runner]] and specified
  [[live-agent-docker-dogfood]].
- Projected the first implementation slice: rerun-safe two-task executable
  fixture, deterministic shared-probe instructions, workspace-bound role
  sessions, strict role result schemas, and focused setup/schema tests.
- Replaced the prototype verifier with pure invariant evaluation plus an
  API/SQLite/role-result/fixture adapter. Added regressions for empty handoff,
  unfinished work, missing contention, event drift, and failed executable
  behavior.
- Superseded the proposed provider runner with
  [[ADR-0012-acp-self-agent-audit]]: use the existing production Docker host and
  real agents directly against isolated ACP worktrees; add no orchestration MJS
  or package command.
- Ran the production ACP image as hardened `acp-self` with durable SQLite,
  workspace bindings, distinct planner/workers/reviewer, isolated worktrees,
  checkpoints, memories, artifacts, requested-changes loops, approvals, and
  terminal work.
- Found and fixed three production gaps through ACP work: daemon-global Compose
  names (`work_mrihmddh1`), incomplete auth-on worker bootstrap
  (`work_mrihmdv42`), and incomplete reviewer scope guidance
  (`work_mrii6qjcy`). All reached `completed`; every lease was released; the
  audit event log ended at sequence 190.
- Re-ran the integrated `dogfood:docker-self` gate successfully across Compose
  project isolation, SQLite/restart, hardened worker and reviewer lifecycles,
  all transports, HA, and both edge topologies.

## Decided (do not re-litigate)

- Provider processes stay outside ACP; no provider SDK/credentials in the image.
- No bespoke provider runner is added; the operator launches real agents while
  ACP records coordination.
- The lane is opt-in; deterministic `dogfood:docker-self` remains mandatory.
- Repository audits use isolated ACP worktrees; the active developer worktree is
  never a concurrent agent write target.
- Success requires process, coordination, security, durable-event, structured
  evidence, and real fixture behavior proof.

## Exact next action

Repeat `acp-self` periodically against bounded production-risk areas. The known
authorization backlog is [[ADR-0013-review-collaboration-permission]]: replace
the reviewer's coarse `workspace:write` dependency with a target-bound review
collaboration scope before claiming capability-isolated least privilege.

## Links

[[ADR-0012-acp-self-agent-audit]] ·
[[live-agent-docker-dogfood]] · [[codex-dogfood-production-testing]]
