---
type: handoff
status: active
date: 2026-07-15
issue: 328
tags: [handoff, quickstart, docker-self, recovery]
aliases: [2026-07-15-recovery-review-quickstart]
---

# Recovery and Review Quickstart Handoff

## Recovered Work

- Branch: `feat/recovery-review-quickstart`; issue #328.
- Docker ACP project: `acp-self-openapi`; workspace `workspace_mrlaz3fq1`;
  work `work_mrleq2bfs`.
- PR #332 / issue #327 are merged and closed. The Docker ACP review, grill, and
  work lifecycle all completed; its external GitHub merge gateway lacked
  credentials, so the authenticated host CLI performed the already-approved
  remote merge.

## Accepted Design

[[ADR-0018-recovery-review-quickstart]] selects a durable SQLite named volume,
real HTTP `201`/`409` lease contention, a saved nonzero cursor, checkpoint and
handoff events after that cursor, a mid-work container restart, tail replay,
durable state reload, and approval before completion. The public contract is
documented in [[recovery-review-quickstart]].

The implementation extends the existing
`scripts/acp-docker-self-dogfood.mjs` entry point with `--quickstart`; it does
not create a new provider runner or orchestration `.mjs` file. The aggregate
Docker self-dogfood gate must execute the same scenario against its reused
image.

## Implementation Order

1. Add pure lease-race and replay-tail invariant helpers with focused tests.
2. Add the isolated quickstart lifecycle to the existing Docker self-dogfood
   orchestrator.
3. Wire `pnpm quickstart` and invoke the same scenario from aggregate Docker CI.
4. Run focused tests, static gates, the public command, the aggregate Docker
   gate, wiki parity, and an ACP grill/review.

## Acceptance Evidence Required

- one `201` lease result and one HTTP `409 lease_conflict`;
- saved cursor greater than zero;
- replayed events all newer than the cursor and containing the durable
  checkpoint/handoff tail;
- work, checkpoint, and handoff survive the actual restart;
- review approved before `completed`, with no active demo lease;
- deterministic cleanup and collision-safe resource names;
- no provider credential or external service dependency.

## Referenced by

[[ADR-0018-recovery-review-quickstart]] · [[recovery-review-quickstart]]
