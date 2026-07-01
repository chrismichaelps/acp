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

## Referenced by

[[README]] · [[protocol-implementation-2026-06-28]]
