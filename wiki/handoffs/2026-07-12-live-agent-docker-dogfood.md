---
date: 2026-07-12
topic: live-agent-docker-dogfood
from_role: Architect
to_role: Shadow
status: IN_PROGRESS
maturity: EXPLORING
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

## Decided (do not re-litigate)

- Provider processes stay outside ACP; no provider SDK/credentials in the image.
- Default first adapter is host `codex exec` with workspace-write sandboxing.
- The lane is opt-in; deterministic `dogfood:docker-self` remains mandatory.
- First prove the runner on an isolated two-task fixture; ACP repository clones
  are the next bounded slice.
- Success requires process, coordination, security, durable-event, structured
  evidence, and real fixture behavior proof.

## Exact next action

Shadow: implement the accepted design in bounded files:

1. Add a supervised external runner and testable support module under
   `scripts/live-test/`.
2. Wire `pnpm dogfood:docker-agents` and focused unit tests.
3. Run the command with real Codex processes, preserve the report/transcripts,
   record every bug or gap, fix verified defects, and rerun.

## Links

[[ADR-0011-live-agent-docker-dogfood-runner]] ·
[[live-agent-docker-dogfood]] · [[codex-dogfood-production-testing]]
