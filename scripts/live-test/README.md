# Live-Agent Docker Coordination Harness

Design source: `wiki/references/live-agent-docker-dogfood.md` and
`wiki/decisions/ADR-0011-live-agent-docker-dogfood-runner.md`.

Current status: the setup, role prompts, and verifier are the earlier manual
prototype. The accepted implementation slice will wire them into
`pnpm dogfood:docker-agents`, launch real Codex processes against the production
Docker image, and harden the verifier. Until that command lands, this directory
is not a turnkey production gate.

## Layout

- `setup.mjs` — builds a throwaway work repo + host data dir under a run dir.
- `roles/` — role-prompt templates handed to each subagent (goal + rules + CLI,
  no command script).
- `verify.mjs` — prototype API/SQLite invariant verifier; known gaps are recorded
  in the design handoff and must be fixed before the wired command is accepted.

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
