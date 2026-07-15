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

## Implementation Evidence

- Documentation-first commit: `3903428`.
- `package.json` exposes `pnpm quickstart`; the existing
  `acp-docker-self-dogfood.mjs` entry point owns public and aggregate modes.
- Pure race/replay contract: 11/11 focused tests passed in clean Linux.
- Clean Linux lint, typecheck, 153-file production build, and full suite passed:
  117 files / 649 tests, with 2 files / 13 Postgres tests intentionally skipped.
- Production image run `issue328-live`: worker A won, worker B received HTTP
  `409 lease_conflict`, saved cursor `8`, replayed `9,10`, restored the running
  work/checkpoint/handoff, approved review, released the lease, completed work,
  and removed its container/volume.
- Reuse-image run `issue328-resume`: worker B won with the same invariant
  evidence, proving the scenario does not depend on a fixed race winner.

Full repository gates, aggregate Docker self-dogfood, ACP grill/review, PR, and
merge remain.

## CI Repair

The first exact-head Docker job on PR #333 returned NO-GO before the quickstart
started. Docker Desktop emitted `No such volume` during local pre-clean, while
the GitHub Linux daemon emitted lowercase `no such volume`. The cleanup helper
matched only the uppercase form and incorrectly treated an already-absent
volume as fatal. The accepted repair is a case-insensitive match restricted to
`no such container|volume`; unrelated removal failures must still fail closed.
The exported matcher and its focused upper/lower/fail-closed regression now pass
12/12 clean-Linux tests.

## Independent Review Repair

Independent PR review returned NO-GO on two additional production blockers,
both recorded as open comments in the Docker ACP review:

1. standalone quickstarts used the daemon-global
   `acp:docker-self-dogfood` tag, so concurrent checkouts could retag the image
   between build and run and validate the wrong branch;
2. the runner printed `{ "ok": true }` before final cleanup, and stopped
   cleanup after the first removal error, so failure could produce contradictory
   success evidence and leave later resources unattempted.

The accepted repair gives standalone runs a run-scoped image that they own and
remove, while aggregate skip-build mode reuses and preserves its existing
image. Cleanup attempts all owned resources, terminal evidence moves after
verified cleanup, and combined execution/cleanup failures remain visible.
Focused regressions must cover image selection, owned-image cleanup, aggregate
preservation, all-resource cleanup, no publish on cleanup failure, and
dual-failure preservation before the ACP comments can be resolved.

The first live run of that repair correctly withheld terminal success but
exposed a Docker dependency race: starting container and volume deletion in one
`Promise.allSettled` let `volume rm` arrive before `docker rm -f` had completed,
returning `volume is in use`. Docker ACP records this as a third open blocker.
The follow-up contract serializes the dependency boundary—container removal
first, volume and owned-image removal second—while retaining exhaustive attempts
and aggregated failures. The failed run removed its container and owned image;
the remaining volume is cleanup evidence, not an accepted result.

## Final Repair Evidence

- Clean Linux focused formatting, lint, and 19/19 orchestration tests pass.
- Standalone run `issue328-isolated` built
  `acp:quickstart-issue328-isolated`, proved HTTP `409 lease_conflict`, saved
  cursor `8`, replayed `9,10`, restored checkpoint/handoff, approved review,
  released the lease, and completed work. Container, volume, and owned image
  were absent before `{ "ok": true }` was printed.
- Aggregate-reuse run `issue328-reuse` exercised the same function against
  `acp:docker-self-dogfood`, with the opposite worker winning and otherwise
  identical evidence. Its container and volume were removed while the aggregate
  image digest `sha256:2d9a5a3173d5...` remained present.
- The Docker ACP coordination host recovered healthy after restart and retains
  the work, review, grill, checkpoints, artifact, and three open repair
  comments. Those comments remain unresolved until independent re-review.

## Referenced by

[[ADR-0018-recovery-review-quickstart]] · [[recovery-review-quickstart]]
