---
type: reference
tags: [reference, dogfood, codex, testing]
aliases: [codex-dogfood-production-testing]
---

# Codex Dogfood Production Testing

ACP should be exercised by real agent workflows, not only synthetic transport
tests. The first Codex dogfood lane treats Codex as a normal ACP worker and runs
against a live host through the public REST surface. This keeps the test honest:
session bootstrap, scoped authorization, workspace creation, work claim/state,
lease lifecycle, checkpointing, memory, pull request artifact references, review
request/approval, terminal work completion, event publication, and event replay
all cross the same boundary an adapter would use.

The repeatable smoke command is:

```bash
ACP_BASE_URL=http://localhost:4317 \
  node scripts/acp-codex-dogfood-smoke.mjs
```

The multi-agent command is:

```bash
ACP_BASE_URL=http://localhost:4317 \
  node scripts/acp-codex-dogfood-multi-agent.mjs
```

`ACP_BASE_URL` may point at a local server, a staging host, or a production-like
host. The runner initializes its own `agent_codex_dogfood` session with explicit
ACP scopes and does not print the bearer token. `ACP_DOGFOOD_RUN_ID` can pin the
run id for correlation, `ACP_DOGFOOD_WORKER_ID` can select a different worker
identity, and `ACP_DOGFOOD_PR_URL` can attach a real pull request URL instead of
the default placeholder reference.

The expected output is a compact JSON object containing the workspace, work,
lease, checkpoint, memory, artifact, review, event ids, and event replay count.
A successful run means ACP can coordinate a Codex-shaped worker through the core
v0.1 loop, including the review gate required before completion. It does not
prove model quality, file editing, branch hygiene, GitHub permissions, or
multi-agent scheduling; those remain adapter-level production tests layered on
top of this host smoke.

The multi-agent lane creates distinct planner, worker A, worker B, and reviewer
sessions. The workers contend for the same work claim and the same worktree
lease, so the runner expects exactly one successful claim, one
`claim_conflict`, one granted lease, and one `lease_conflict`. The winning
worker publishes checkpoint, memory, artifact, and progress state; the reviewer
reads the latest checkpoint and handoff memory, requests changes once, approves
a second review, and verifies replayed event sequence monotonicity before
terminal completion. The runner also reads
`GET /v1/leases?workspace_id=...` after renewal and release, proving current and
terminal lease state can be inspected without reconstructing it from replay.

This scenario intentionally exposes current protocol pressure points. Claim
contention now has a first-class protocol code; actor identity is still
session-scoped rather than enforced against every actor-like payload field.

## Referenced by

[[README]] · [[protocol-implementation-2026-06-28]]
