# Live Agent Coordination Test

Harness for the live agent coordination test described in
`docs/superpowers/specs/2026-07-02-live-agent-coordination-test-design.md`.

Real Claude Code subagents (planner / 2 workers / reviewer), each unscripted,
coordinate through a live SQLite-backed, auth-on ACP host using only the shipped
`acp` CLI. The run ends with a verifier that asserts coordination invariants read
back both from the API and directly from the SQLite file.

## Layout

- `setup.mjs` — builds a throwaway work repo + host data dir under a run dir,
  prints the paths and env the host and agents need. Idempotent per run id;
  never deletes anything outside its own run dir.
- `roles/` — role-prompt templates handed to each subagent (goal + rules + CLI,
  no command script).
- `verify.mjs` — reads back the workspace event history via the `acp` CLI and the
  SQLite file and asserts the six invariants from the design.

## Usage

The main Claude session orchestrates:

1. `node scripts/live-test/setup.mjs <run-id>` → prints RUN_DIR, WORK_REPO,
   SQLITE_PATH.
2. Launch host: `ACP_STORAGE_ADAPTER=sqlite ACP_SQLITE_PATH=<path>
   ACP_REQUIRE_AUTH=true ACP_PORT=4318 node dist/app/server/main.js`.
3. Spawn the planner subagent with `roles/planner.md` (+ substituted paths).
4. Spawn worker A/B subagents with `roles/worker.md`.
5. Spawn the reviewer subagent with `roles/reviewer.md`.
6. `node scripts/live-test/verify.mjs <workspace-id>` → asserts invariants.
