# Live-Agent Docker Coordination Harness

Design source: `wiki/references/live-agent-docker-dogfood.md` and
`wiki/decisions/ADR-0011-live-agent-docker-dogfood-runner.md`.

Current status: the isolated two-task fixture, workspace-bound role prompts,
structured result schemas, and strict API/SQLite/role/file verifier are hardened.
The accepted implementation slice still must wire `pnpm dogfood:docker-agents`
and launch supervised Codex processes against the production Docker image. Until
that command lands, this directory is not a turnkey production gate.

## Layout

- `setup.mjs` — builds a throwaway work repo + host data dir under a run dir.
- `roles/` — role-prompt templates handed to each subagent (goal + rules + CLI,
  no command script).
- `schemas/` — strict final-result contracts consumed by the provider runner.
- `verify-support.mjs` — pure invariant evaluation used by focused regression
  tests.
- `verify.mjs` — strict API/SQLite/role-result/fixture adapter and report writer.

## Usage

Legacy manual prototype flow:

1. `node scripts/live-test/setup.mjs <run-id>` → prints RUN_DIR, WORK_REPO,
   SQLITE_PATH.
2. Launch host: `ACP_STORAGE_ADAPTER=sqlite ACP_SQLITE_PATH=<path>
ACP_REQUIRE_AUTH=true ACP_PORT=4318 node dist/app/server/main.js`.
3. Spawn the planner agent with `roles/planner.md` (+ substituted paths).
4. Spawn worker A/B subagents with `roles/worker.md`.
5. Spawn the reviewer subagent with `roles/reviewer.md`.
6. `node scripts/live-test/verify.mjs <workspace-id>` → asserts invariants.

This flow uses a native host and does not satisfy the accepted Docker/model-
supervision contract. It remains only as implementation input for the next
slice.
