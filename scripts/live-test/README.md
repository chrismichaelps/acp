# Live-Agent Docker Coordination Harness

Design source: `wiki/references/live-agent-docker-dogfood.md` and
`wiki/decisions/ADR-0012-acp-self-agent-audit.md`.

Current status: the isolated fixture, role prompts, schemas, and strict verifier
are reusable evidence contracts. They are not a provider runner or package
command. Production repository audits use the existing Dockerized ACP host and
real agents directly under `wiki/decisions/ADR-0012-acp-self-agent-audit.md`.

## Layout

- `setup.mjs` — builds a throwaway work repo + host data dir under a run dir.
- `roles/` — role-prompt templates handed to each subagent (goal + rules + CLI,
  no command script).
- `schemas/` — strict final-result contracts available to an operator or agent
  provider invocation.
- `verify-support.mjs` — pure invariant evaluation used by focused regression
  tests.
- `verify.mjs` — strict API/SQLite/role-result/fixture adapter and report writer.

## Usage

Fixture diagnostic flow:

1. `node scripts/live-test/setup.mjs <run-id>` → prints RUN_DIR, WORK_REPO,
   SQLITE_PATH.
2. Launch host: `ACP_STORAGE_ADAPTER=sqlite ACP_SQLITE_PATH=<path>
ACP_REQUIRE_AUTH=true ACP_PORT=4318 node dist/app/server/main.js`.
3. Spawn the planner agent with `roles/planner.md` (+ substituted paths).
4. Spawn worker A/B subagents with `roles/worker.md`.
5. Spawn the reviewer subagent with `roles/reviewer.md`.
6. `node scripts/live-test/verify.mjs <workspace-id>` → asserts invariants.

This fixture flow is a diagnostic oracle. It does not replace an `acp-self`
session against the production Docker host and ACP repository.
