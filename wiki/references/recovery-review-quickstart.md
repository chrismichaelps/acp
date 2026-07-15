---
type: reference
status: active
date: 2026-07-15
tags: [quickstart, docker, recovery, leases, review]
aliases: [recovery quickstart, collision recovery review demo]
---

# Recovery and Review Quickstart

## Purpose

Run ACP's collision, crash-recovery, and review story against the ordinary
production Docker image with no model credentials and no external services.
The executable contract is defined by
[[ADR-0018-recovery-review-quickstart]].

## Run

Requirements: Docker and the repository's pinned pnpm runtime.

```bash
pnpm quickstart
```

The first run builds the production image under a run-scoped tag. The command
then creates an isolated SQLite-backed ACP container and named volume, narrates
the lifecycle, cleans its owned container, volume, and image, and only then
prints a structured success record. Set
`ACP_DOGFOOD_RUN_ID=<unique-value>` when a stable run identifier is useful.

## What the Command Proves

1. Two distinct workers concurrently request one file lease.
2. Exactly one request succeeds; the loser receives HTTP `409` with
   `lease_conflict`.
3. A worker starts the work and records a nonzero event cursor.
4. A checkpoint and handoff are appended after that cursor.
5. The ACP container restarts while the work is still active.
6. `events list --after <saved_seq>` returns only the later checkpoint and
   handoff tail in strictly increasing sequence order.
7. Durable work, checkpoint, and handoff state are reloaded before execution
   continues.
8. A review is requested and approved before the lease is released and work is
   completed.

The final JSON includes the run, workspace, work, lease, review, saved cursor,
replayed sequence numbers, conflict status/code, and terminal state.

## Why SQLite, Not Memory

The in-memory adapter is appropriate for process-local tests, but a container
restart creates a new process and discards that state. SQLite on an isolated
named volume preserves the exact zero-setup developer experience while making
the recovery claim true. This is a single-node demonstration; HA durability
remains covered by the broader Docker self-dogfood gate.

## Failure and Cleanup

The command exits nonzero on any invariant drift. Its standalone image,
container, and volume are run-scoped and removed on success and failure. The
aggregate Docker gate reuses its already-built shared image and never removes
it. This separation prevents concurrent checkouts from retagging or executing
one another's images. The quickstart does not publish a host port, mutate a
repository, contact GitHub, or read provider credentials.

Startup and final cleanup treat Docker's case-varying "no such container,"
"no such volume," and "no such image" responses as idempotent absence. Cleanup
attempts every owned resource even when an earlier removal fails, then reports
all real failures. The terminal `{ "ok": true }` record is emitted only after
final cleanup succeeds; if execution and cleanup both fail, the command
preserves both errors and emits no success record.

## Scope

This quickstart is deterministic product evidence. It does not replace the
operator-driven real-agent audit in [[ADR-0012-acp-self-agent-audit]] and does
not claim hostile-client identity security; local auth-off mode is used only
inside the isolated demonstration boundary.

## Referenced by

[[references/_MOC]] · [[architecture/_MOC]] ·
[[2026-07-15-recovery-review-quickstart]]
