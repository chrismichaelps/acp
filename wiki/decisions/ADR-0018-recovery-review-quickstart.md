---
type: decision
status: ACCEPTED
date: 2026-07-15
tags: [adr, quickstart, docker, recovery, leases, review]
aliases: [ADR-0018, recovery-review-quickstart-decision]
---

# ADR-0018 — Recovery and Review Quickstart

## Context

ACP's lease, durable replay, and review contracts are individually documented
and exercised by broad dogfood lanes, but a new developer cannot run their
combined value proposition as one short story. Issue #328 asks for a
copy-paste demonstration in which two workers collide on one file, the host
restarts during active work, the winning worker resumes from an event cursor,
and review gates completion.

The issue suggests in-memory storage for zero setup. That adapter is
process-local and intentionally loses all state when the host restarts, so it
cannot truthfully demonstrate crash recovery. The repository already owns a
production-image Docker self-dogfood orchestrator, a compiled CLI wrapper, and
SQLite named-volume support.

## Decision

Expose `pnpm quickstart` as a curated mode of the existing
`scripts/acp-docker-self-dogfood.mjs` entry point. Do not add a provider runner
or another orchestration `.mjs` file. The command builds the ordinary production
image under a run-scoped tag, starts one isolated auth-off ACP container with
SQLite on a named volume, and drives only public HTTP and CLI surfaces. A
standalone run owns and removes its run-scoped image. Aggregate Docker
self-dogfood instead reuses its already-built shared image and never removes
that image.

The quickstart must:

1. initialize two distinct workers and one reviewer;
2. create one workspace and active work unit;
3. race two HTTP lease requests for the same file and require exactly one
   `201` winner plus one `409` `lease_conflict` loser;
4. save a nonzero event sequence after work starts;
5. create a checkpoint and nonempty handoff after that cursor;
6. restart the actual ACP container and wait for readiness;
7. replay with `events list --after <saved_seq>` and require a strictly newer
   tail containing the checkpoint and handoff events;
8. reload durable work, checkpoint, and handoff state before continuing;
9. request and approve review before releasing the lease and completing work;
10. emit readable narration, attempt removal of every owned container, volume,
    and image on success or failure, and only then publish the final structured
    evidence object.

The aggregate `pnpm dogfood:docker-self` gate invokes the identical quickstart
scenario against its already-built image. CI therefore protects the public
example without paying for a second image build.

## Invariants

- A restart is mid-lifecycle, not a persistence check after completion.
- The saved cursor is greater than zero, and every replayed event has a larger
  sequence number.
- Replay contains only events appended after the saved cursor.
- The conflict assertion preserves the HTTP status; CLI exit status alone is
  insufficient evidence for the documented wire contract.
- The review must be approved before `completed` is accepted.
- The final state has no active demonstration lease.
- Run-derived container, volume, and standalone image names avoid
  cross-checkout collisions. Building one checkout cannot retag the image used
  by another checkout between build and run.
- Aggregate skip-build mode reuses the aggregate image and does not claim or
  remove it.
- Pre-clean is idempotent across Docker daemons: a case-insensitive
  `no such container|volume|image` response is success, while every other
  cleanup failure remains fatal.
- Cleanup attempts every owned resource even if an earlier removal fails, then
  reports every real removal error.
- The terminal `{ "ok": true }` evidence is published only after final cleanup
  succeeds. When lifecycle execution and cleanup both fail, neither error is
  discarded.
- No model or provider credential is read, mounted, or required.

## Failure Contract

Any unexpected status, error code, event ordering, missing durable record,
review state, work state, readiness timeout, or cleanup failure makes the
command exit nonzero. Narration never substitutes for assertions. The final
structured result is printed only after all invariants and final cleanup pass.
Cleanup failure can never be accompanied by a prior `{ "ok": true }` record.

## Relationship to ACP-Self Audits

[[ADR-0012-acp-self-agent-audit]] still governs operator-driven audits in which
real agents use ACP to discover product gaps. This decision does not automate
agents or replace that audit. It curates a deterministic developer quickstart
from the production Docker surfaces already used by CI.

## Consequences

Developers receive a one-command proof of ACP's differentiators without
credentials or a Postgres stack. SQLite adds durable state while remaining
zero-configuration. Reusing the production image and existing orchestrator
keeps the example wired to shipped behavior and prevents a disconnected demo
from drifting.

## Referenced by

[[recovery-review-quickstart]] · [[architecture/_MOC]] · [[decisions/_MOC]] ·
[[2026-07-15-recovery-review-quickstart]]
