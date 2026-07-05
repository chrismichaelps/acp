# Changelog

Temporal ledger of logic deltas (one line each). Forensic Guardian appends.

- 2026-07-05 · cli-parse-dispatch-pattern slice · refactored `parseArgs` around
  an explicit command invocation and ordered dispatch-rule pattern so command
  lookup, fallback handling, and handler invocation scale through the registry
  instead of central parser branching; preserved the public `CliRequest` surface
  and added regressions for unknown commands and missing subcommands ·
  validation: focused CLI parser/auth tests, typecheck, and file-size passed ·
  risk LOW

- 2026-07-05 · docker-ha-multi-agent-dogfood slice · expanded the reusable
  Postgres/HA Docker proof from restart durability into a real multi-agent
  lifecycle: planner, two workers, and reviewer sessions now contend for a work
  claim and a resource lease, persist checkpoint/memory/artifact handoff state,
  run request-changes then approval, restart the host mid-review and after
  completion, and replay the Postgres event log for monotonic sequence and
  required lifecycle events. The run exposed two production races, so storage now
  exposes atomic `putIfAbsent` and `replaceIf` operations across memory, SQLite,
  and Postgres; work claims use conditional replacement, lease resources use a
  deterministic Postgres-safe lock row, and `pg-notify` publishing uses
  `SELECT pg_notify(...)` to avoid parameterized `NOTIFY` syntax failures ·
  validation: focused work-unit/lease/storage/event tests and Docker HA dogfood
  passed locally with 23 replayed events · risk MEDIUM

- 2026-07-04 · docker-ha-dogfood-runner slice · added
  `scripts/acp-docker-ha-dogfood.mjs` and the `dogfood:docker-ha` package script
  so the Postgres/HA Compose profile can be validated outside GitHub Actions with
  the same production-oriented flow: start `--profile ha`, drive `./bin/acp`
  against `acp-ha`, write workspace/work/checkpoint/memory state, restart the
  host, read work and events back from Postgres, and tear the stack down ·
  documented and drift-checked the Docker dogfood environment controls in
  `.env.example`, then wired the Docker workflow's HA job to call the reusable
  Node script instead of inlining shell.

- 2026-07-04 · docker-ha-profile-and-ci slice · added a Compose `ha` profile (the
  ADR-0008 self-host-ha stack: `postgres:16-alpine` + `pg-notify` fan-out,
  auto-migrating on boot) alongside the default `sqlite` profile in one
  `docker-compose.yml`, taught `bin/acp` to auto-detect the running host service
  (`acp` or `acp-ha`), added `acp:ha:up`/`down`/`logs` npm scripts, and added a
  `.github/workflows/docker.yml` CI guard with two jobs — the Docker-hosted CLI
  dogfood and a Postgres/HA durability check that creates work, restarts the host,
  and reads it back. No untrusted GitHub event input reaches any `run:` step ·
  validation: both Compose profiles pass `docker compose config`; local
  lint/format/typecheck/file-size/env/tests green; Docker/HA runtime proven on CI
  (local Docker store was disk-full) · risk LOW

- 2026-07-04 · docker-daily-driver slice · packaged the full ACP host as a
  persistent Docker service for terminal-first feature work: `docker-compose.yml`
  runs the production image with durable SQLite on a named volume (`local`
  profile, auth off → mutations as `worker_system`), a `bin/acp` wrapper drives
  the compiled CLI inside the container (symlink-safe for PATH installs, forwards
  `ACP_RPC_TOKEN`, refuses with a hint when the host is down), a Dockerfile
  `/data` mount point owned by the `node` user makes the volume writable
  non-root, and `acp:up`/`acp:down`/`acp:logs` npm scripts plus a README section
  document it · validation: `docker compose up -d --build` → host healthy, drove
  `acp workspace/work create + list` via the wrapper, and confirmed state
  survives `docker compose restart` (work read back by id after restart) ·
  risk LOW

- 2026-07-04 · docker-dogfood-event-sequence slice · tightened
  `npm run dogfood:docker-cli` from set-style required event checks to an exact
  event sequence assertion, so duplicate review lifecycle emissions and
  out-of-order replay drift fail the production-image dogfood lane immediately ·
  validation: script syntax check, format, lint, typecheck, file-size, and build
  passed; Docker execution blocked locally by usage-limit guard · risk LOW

- 2026-07-04 · review-event-deduplication slice · fixed duplicate
  `review.approved` / `review.rejected` / `review.changes_requested` emissions
  by letting `ReviewService` own the review event while moving the coupled work
  state through a silent internal transition. Approval and request-changes tests
  now pin the exact event history, matching the duplicate caught by the
  Docker-hosted CLI dogfood runner · validation: targeted review/work-unit tests
  passed (15 tests), plus check:env, format, lint, typecheck, file-size, and
  build; Docker rerun blocked by usage-limit guard · risk MEDIUM

- 2026-07-04 · docker-cli-dogfood-runner slice · added
  `scripts/acp-docker-cli-dogfood.mjs` and `npm run dogfood:docker-cli` so ACP
  can repeatedly build its production Docker image, run the host container, drive
  the compiled CLI inside that container, verify the workspace/work/review event
  lifecycle, and tear the container down automatically · validation:
  `npm run dogfood:docker-cli` passed with `workspace_mr6rwfvt1` /
  `work_mr6rwgr82` and 12 replayed events · risk LOW

- 2026-07-04 · spec-cli-parity slice · refreshed `specs.md` §22 from the old
  placeholder CLI (`acp init`, `workspace add`, positional lease/checkpoint
  calls) to the implemented session-first, workspace-scoped grammar, including
  memory, artifact content, review approval/cancellation, event replay, and event
  streaming. Also added `review cancel` to the runtime CLI usage text and README
  command reference so every visible command surface matches the parser ·
  validation: full local gate passed (check:env, format, lint, typecheck,
  file-size, build, 688 tests; 14 skipped) · risk LOW

- 2026-07-04 · docker-dogfood-readme slice · documented that the production
  Docker image contains the compiled `acp` CLI and can smoke-test itself from
  inside the running container over `ACP_BASE_URL=http://127.0.0.1:4317`. The
  update is backed by a real Docker-hosted ACP workflow: built image, green
  `/health` and `/ready`, then built CLI sessions for planner/worker/reviewer
  created a workspace, work item, claim, `running` transition, checkpoint,
  memory, markdown artifact, review request, review approval, completion, and
  event replay with 12 events · validation: Docker build passed and container
  dogfood completed for `workspace_mr6rga48d` / `work_mr6rgakge` · risk LOW

- 2026-07-04 · cli-command-dispatch-refactor slice · replaced the central CLI
  command spread object with a `buildCommandRegistry` composition step that
  assembles feature command tables into a `ReadonlyMap`, rejects duplicate keys
  at module initialization, and keeps `parseArgs` on the tokenize → resolve →
  execute path as the CLI grows · validation: full local gate passed (check:env,
  format, lint, typecheck, file-size, build, 688 tests; 14 skipped) · risk LOW

- 2026-07-04 · cli-dogfood-file-size slice · split the multi-agent CLI dogfood
  harness into `cli-dogfood-support.ts`, leaving the test focused on the
  lifecycle assertions while keeping the real `parseArgs` + `runCliRequest`
  execution path intact. Docker validation also corrected pnpm 11 build-script
  approvals by moving them to `pnpm-workspace.yaml`, copied that policy into the
  image install layers, and mounted `/health` + `/ready` in the served HTTP layer
  so the Docker healthcheck exercises the same host composition as production ·
  validation: focused live-socket tests passed (4 tests), Docker build passed,
  and container `/health` + `/ready` probes returned 200 · risk LOW

- 2026-07-04 · cli-dogfood-multi-agent slice · proved the entire `acp` CLI
  end-to-end with four racing agent identities (planner, two workers, reviewer)
  across the full v0.1 loop — session bootstrap, workspace/work, claim race
  (one winner + one `claim_conflict`), lease race (one winner + one
  `lease_conflict`), renew/read-back, checkpoint/memory/artifact handoff, review
  gate with a changes-requested round trip, lease release, terminal completion,
  and event replay. Two independent proofs: a CI-gated in-process test
  (`src/app/cli/cli-dogfood-multi-agent.test.ts`, real `parseArgs` +
  `runCliRequest` over an ephemeral socket) and a runnable lane
  (`npm run dogfood:cli`) that self-boots the compiled server and spawns the real
  `dist/app/cli/main.js` binary per command. CLI has no event-forge verb by
  design, so only domain-emitted events are asserted · validation: full gate
  passed (lint, format, typecheck, file-size, env, 685 tests; 14 skipped) plus a
  green `npm run dogfood:cli` real-binary run (25 events replayed) · risk LOW

- 2026-07-04 · hosted-codex-dogfood-sessions slice · added
  `ACP_DOGFOOD_WORKSPACE_ID` so Codex smoke and multi-agent dogfood runners can
  bind every session to a provisioned workspace and run against hosts with
  `ACP_REQUIRE_WORKSPACE_BINDINGS=true` while preserving local workspace creation
  by default · validation: full local gate passed (check:env, format, lint,
  typecheck, file-size, build, 684 tests; 14 skipped) · risk LOW

- 2026-07-04 · hosted-workspace-binding-policy slice · added hosted and
  self-host-ha `ACP_PROFILE` presets with Postgres, pg-notify, auth, and
  workspace-bound session defaults, plus `ACP_REQUIRE_WORKSPACE_BINDINGS`
  enforcement at HTTP and native RPC `session.initialize` · validation: targeted
  config/router/RPC tests passed (33 tests) · risk MEDIUM

- 2026-07-04 · rpc-review-workspace-authorization slice · enforced ADR-0009
  workspace bindings on native RPC review request, approve, reject,
  request_changes, cancel, work list, and workspace list handlers, deriving
  workspace from parent work or stored review ids before review state changes ·
  validation: targeted native RPC review tests passed (4 tests) · risk MEDIUM

- 2026-07-04 · rpc-derived-evidence-workspace-authorization slice · enforced
  ADR-0009 workspace bindings on native RPC artifact update/delete/content,
  artifact work lists, checkpoint work lists, and latest checkpoint reads whose
  workspace is derived from a stored artifact or parent work id · validation:
  targeted native RPC derived evidence tests passed (6 tests) · risk MEDIUM

- 2026-07-04 · rpc-evidence-memory-event-workspace-authorization slice · enforced
  ADR-0009 workspace bindings on native RPC artifact/checkpoint creation,
  artifact/checkpoint workspace lists, memory create/list, and event
  list/subscribe handlers whose payload carries an explicit workspace id ·
  validation: targeted native RPC direct-workspace tests passed (7 tests) · risk
  MEDIUM

- 2026-07-04 · rpc-work-lease-workspace-authorization slice · added
  [[rpc-resource-workspace-auth]] and enforced ADR-0009 workspace bindings on
  native RPC work get/claim/update/publish handlers and lease renew/release/revoke
  handlers whose target workspace is derived from the stored resource id ·
  validation: targeted native RPC handler tests passed (8 tests) · risk MEDIUM

- 2026-07-04 · rpc-workspace-auth-primitive slice · added native RPC
  `authorizeRpcActor`/`authorizeRpcWorkspace`/`rpcWorkspaceActor` and applied
  ADR-0009 workspace bindings to direct-workspace RPC handlers for workspace
  update/archive, work create/list, and lease request/list · validation:
  targeted native RPC handler tests passed (7 tests) · risk MEDIUM

- 2026-07-04 · http-mutation-workspace-authorization slice · added
  [[resource-workspace-auth]] and enforced ADR-0009 workspace bindings on HTTP
  mutation routes whose workspace is derived from work, lease, artifact, or
  review ids, including review creation from `work_id` · validation: targeted
  mutation/workspace-scope route tests passed (8 tests) · risk MEDIUM

- 2026-07-04 · http-creation-workspace-authorization slice · enforced
  ADR-0009 workspace bindings on HTTP artifact and checkpoint creation, so a
  bearer session with `artifact:create` or `checkpoint:create` still cannot write
  into an unbound workspace · validation: targeted workspace-scope route test
  passed (4 tests) · risk MEDIUM

- 2026-07-04 · http-derived-workspace-authorization slice · enforced
  ADR-0009 workspace bindings on HTTP read routes whose target workspace is
  derived from a work or artifact id, including work resume reads, work-scoped
  checkpoint/artifact/review indexes, latest checkpoint lookup, and artifact
  content reads · validation: full local gate passed (check:env, format, lint,
  typecheck, file-size, build, 654 tests; 14 skipped) · risk MEDIUM

- 2026-07-04 · http-workspace-scope-authorization slice · added
  [[route-support]] `authorizeActor`/`authorizeWorkspace` and enforced
  ADR-0009 workspace bindings on HTTP routes whose target workspace is explicit
  in the path, query, or body (work create, lease create/list, memory, events,
  workspace aggregate/update/archive routes) · validation: full local gate passed
  (check:env, format, lint, typecheck, file-size, build, 652 tests; 14 skipped)
  · risk MEDIUM

- 2026-07-04 · session-workspace-bindings slice · added ADR-0009
  `workspace_ids` bindings to [[session.schema]] and
  `session.initialize` payloads, preserving host-wide sessions as
  `Option.none` while persisting explicit workspace lists through HTTP/RPC
  initialization · validation: full local gate passed (check:env, format, lint,
  typecheck, file-size, build, 644 tests; 14 skipped) · risk MEDIUM

- 2026-07-04 · adr-0009-workspace-scoped-sessions slice · accepted
  [[ADR-0009-workspace-scoped-sessions]], deciding that hosted ACP sessions gain
  optional workspace bindings while permission scopes remain action-oriented;
  implementation is explicitly staged after the ADR · validation: full local gate
  passed (check:env, format, lint, typecheck, file-size, 634 tests; 14 skipped)
  · risk LOW

- 2026-07-04 · postgres-sweeper-leader-election slice · added
  [[sweeper-leadership]] and wrapped [[sweeper]] daemon ticks in
  in-process/Postgres-selected leadership so replicated Postgres hosts take a
  transaction-scoped advisory lock before lease expiry or event-retention
  mutation · validation: full local gate passed (check:env, format, lint,
  typecheck, file-size, build, 634 tests; 14 skipped) · risk MEDIUM

- 2026-07-03 · pg-notify-event-broker slice · added
  `ACP_EVENT_BROKER=in-process|pg-notify`, selected EventBroker adapters through
  [[event-broker-live]], and implemented [[pg-notify-event-broker]] with
  Postgres LISTEN/NOTIFY pointer fan-out over durable event storage · validation:
  full local gate passed (check:env, format, lint, typecheck, file-size, build,
  626 tests; 14 skipped including pg integrations without `ACP_TEST_DATABASE_URL`)
  · risk MEDIUM

- 2026-07-01 · protocol-conformance-hardening slice · closed the last spec-vs-code
  gaps: [[lease-service]] `request` now emits `lease.requested` +
  `lease.granted`/`lease.denied` as outcome pairs (spec §11 lease vocabulary fully
  reachable), scope denial fails a new `ForbiddenError` → `403 forbidden` in
  [[protocol-error]] across [[route-support]] and [[rpc-auth]] (credential
  failures stay 401), and `PublishWorkEventPayload` in [[acp-http-api]] narrows
  to the §12.6 progress vocabulary so workers cannot forge lifecycle events;
  specs §8/§12.6 and README updated to state the semantics · validation: full
  gate green (typecheck, lint, format, file-size, env, 596 tests incl. rebuilt
  dist; +10 tests) · risk MEDIUM (401→403 for underscoped sessions is a
  wire-visible change)

- 2026-07-01 · cli-review-command-registry slice · extracted review CLI parsing
  into [[cli-review-commands]] and wired it into the additive parseArgs registry,
  completing the feature command-map split for [[cli-commands]] without changing
  CLI behavior · validation: targeted CLI parser test, format, lint, typecheck,
  and file-size passed · risk LOW
- 2026-07-01 · cli-artifact-command-registry slice · extracted artifact CLI
  parsing into [[cli-artifact-commands]], including the `artifact pr` convenience
  projection, and wired it into the additive parseArgs registry without changing
  CLI behavior · validation: targeted CLI parser tests, format, lint, typecheck,
  and file-size passed · risk LOW
- 2026-07-01 · cli-checkpoint-command-registry slice · extracted checkpoint CLI
  parsing into [[cli-checkpoint-commands]], moved shared work/workspace collection
  path construction into [[cli-command-support]], and wired checkpoint handlers
  into the additive parseArgs registry without changing CLI behavior ·
  validation: targeted CLI parser test, format, lint, typecheck, and file-size
  passed · risk LOW
- 2026-07-01 · cli-worker-command-registry slice · extracted host-scoped worker
  CLI parsing into [[cli-worker-commands]] and wired it into the additive
  parseArgs command registry, keeping worker presence reads out of the central
  parser file without changing CLI behavior · validation: targeted CLI parser
  test, format, lint, typecheck, and file-size passed · risk LOW
- 2026-07-01 · cli-work-command-registry slice · extracted work CLI parsing
  into [[cli-work-commands]] and wired it into the additive parseArgs command
  registry, reducing [[cli-commands]] file-size pressure without changing CLI
  behavior · validation: targeted CLI parser test, format, lint, typecheck, and
  file-size passed · risk LOW
- 2026-07-01 · cli-workspace-command-registry slice · extracted workspace CLI
  parsing into [[cli-workspace-commands]] and wired it into parseArgs through
  the additive command-map registry, reducing [[cli-commands]] file-size pressure
  without changing CLI behavior · validation: targeted CLI parser test, format,
  lint, typecheck, and file-size passed · risk LOW
- 2026-07-01 · cli-lease-command-registry slice · extracted lease CLI parsing
  into [[cli-lease-commands]] and wired it into the central parseArgs dispatch
  table, reducing [[cli-commands]] file-size pressure without changing CLI
  behavior · validation: targeted CLI parser test, format, lint, typecheck, and
  file-size passed · risk LOW
- 2026-07-01 · env-example-runtime-reference slice · clarified `.env.example` as
  the drift-checked runtime manifest, aligned the SQLite path sample with the
  implemented default, and documented the no-secrets rule in README/spec/wiki ·
  validation: check:env, format:check, and file-size passed · risk LOW
- 2026-07-01 · first-class-work-claim-conflict slice · added
  `ClaimConflictError` / `claim_conflict` for assigned-work claim contention,
  updated HTTP and protocol coverage, and taught the multi-agent dogfood runner
  to expect the first-class code · validation: live authenticated multi-agent
  dogfood smoke, check:env, format, lint, typecheck, file-size, and build passed
  · risk LOW
- 2026-07-01 · architecture-roadmap-rpc-parity-refresh slice · marked the native
  RPC handler re-audit milestones complete in [[architecture/_MOC]] and added
  the cross-transport lease readback parity milestone · validation: check:env,
  format, lint, typecheck, file-size, and build passed · risk LOW
- 2026-07-01 · transport-docs-lease-readback-parity slice · refreshed the
  README transport summary and [[jsonrpc/_MOC]] so REST, native RPC, JSON-RPC,
  and CLI lease readback are described consistently · validation: check:env,
  format, lint, typecheck, file-size, and build passed · risk LOW
- 2026-07-01 · native-rpc-lease-list-command slice · added typed native RPC
  `lease.list` with `workspace:read` scope, direct handler readback, generated
  client coverage, mounted HTTP route coverage, and RPC wiki mirrors ·
  validation: check:env, format, lint, typecheck, file-size, and build passed ·
  risk LOW
- 2026-07-01 · jsonrpc-lease-list-command slice · added JSON-RPC `lease.list`
  as a workspace-scoped projection of `GET /v1/leases?workspace_id=…`, with
  parser coverage and spec/wiki parity · validation: check:env, format, lint,
  typecheck, file-size, and build passed; focused Vitest run blocked by missing
  local Rolldown optional native binding · risk LOW
- 2026-07-01 · readme-lease-list-command-parity slice · refreshed the README
  CLI surface summary so lease readback is listed beside the rest of the lease
  lifecycle commands · validation: check:env, format, lint, typecheck,
  file-size, and build passed · risk LOW
- 2026-07-01 · environment-example-drift-check slice · added `check:env` and a
  CI gate that fails when `.env.example` drifts from the implemented ACP
  environment variable surface · validation: check:env, format, lint,
  typecheck, file-size, and build passed · risk LOW
- 2026-07-01 · documented-environment-example slice · added root
  `.env.example` for host, client, stdio bridge, and dogfood variables; aligned
  the spec config example and [[app-config]] mirror with implemented env names ·
  validation: format, lint, typecheck, file-size, and build passed · risk LOW
- 2026-07-01 · cli-lease-list-command slice · added the lease list CLI command
  as a workspace-scoped read over `GET /v1/leases`, with parser coverage and
  [[cli-commands]] / [[cli-usage]] mirrors · validation: format, lint,
  typecheck, file-size, and build passed; focused Vitest parser run blocked by
  missing local Rolldown optional native binding · risk LOW
- 2026-06-30 · multi-agent-dogfood-lease-readback slice · updated the
  multi-agent dogfood runner and [[codex-dogfood-production-testing]] to verify
  active and released lease state through `GET /v1/leases?workspace_id=…`,
  closing the readback gap exposed by the first multi-agent run · validation:
  live authenticated multi-agent dogfood smoke, format, lint, typecheck,
  file-size, and build passed · risk LOW
- 2026-06-30 · lease-list-read-route slice · added workspace-scoped
  `GET /v1/leases?workspace_id=…` to the HTTP contract and [[acp-router]] so
  workers can inspect current and terminal lease state directly instead of
  reconstructing it from replay · validation: format, lint, typecheck,
  file-size, and build passed; focused Vitest route/contract suite blocked at
  startup by local Rolldown optional native binding mismatch with no install
  performed · risk LOW
- 2026-06-30 · event-stream-auth-parity slice · aligned
  [[event-routes]] SSE authorization with replay by requiring `event:read` before
  opening `GET /v1/events/stream`, and added the route regression · validation:
  format, lint, typecheck, file-size, and build passed; focused Vitest route
  suite blocked at startup by local Rolldown optional native binding mismatch
  with no install performed · risk LOW
- 2026-06-30 · cli-parse-args-dispatch-refactor slice · moved
  [[cli-commands]] unknown-command handling behind a command resolver fallback
  so `parseArgs` composes tokenization, resolution, and execution without owning
  dispatch branching · validation: format, lint, typecheck, file-size, and build
  passed; focused Vitest parser suite blocked at startup by local Rolldown
  optional native binding mismatch with no install performed · risk LOW
- 2026-06-30 · multi-agent-production-dogfood slice · added
  `scripts/acp-codex-dogfood-multi-agent.mjs`, package script
  `dogfood:codex:multi`, and [[codex-dogfood-production-testing]] coverage for
  planner/worker/reviewer sessions, work claim contention, lease conflict,
  checkpoint and memory handoff, review changes, review approval, lease release,
  completion, and monotonic event replay · validation: live authenticated
  multi-agent dogfood smoke passed against a local host with 23 replayed events;
  format, lint, typecheck, file-size, and build passed · risk LOW
- 2026-06-30 · agent-production-dogfood-smoke slice · added
  `scripts/acp-codex-dogfood-smoke.mjs`, package script `dogfood:codex`, and
  [[codex-dogfood-production-testing]] so ACP can be exercised as a live host by
  a Codex-shaped worker across session, workspace, work, lease, checkpoint,
  memory, artifact, review approval, event publication, and replay paths ·
  validation: live authenticated dogfood smoke, format, lint, typecheck,
  file-size, and build passed; broad Vitest startup blocked by local Rolldown
  optional native binding mismatch with no install performed · risk LOW
- 2026-06-30 · secure-session-token-credentials slice · moved HTTP and native
  RPC `session.initialize` from observable timestamp/counter ids to
  high-entropy [[id-clock]] `secureToken` bearer credentials, tightened session
  token shape regressions, and refreshed [[specs.md]], [[README]],
  [[session-service]], [[acp-router]], and [[acp-rpc-handlers]] docs so session
  ids are treated as opaque credentials · validation: format, lint, typecheck,
  file-size, focused identity/session transport tests, and 285-test non-socket
  suite green · risk LOW
- 2026-06-30 · post-rpc-client-ergonomics-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] to close the client-ergonomics slice
  (`acpNativeRpcPath`/`acpNativeRpcUrl`/`acpRpcBearerHeaders`/
  `withAcpRpcBearer`/`acpRpcClientHostLayer`) and record that native RPC has
  reached full technical readiness — every method actor-bridged, mounted over
  real HTTP with auth/telemetry middleware, and double-proven (`RpcTest` +
  live-mounted-HTTP) — with zero in-tree production consumers, since
  [[cli-client]] deliberately targets plain REST; per the standing decision, no
  further RPC-migration slice is selected until a consumer is concretely named
  · docs-only validation: format, file-size, and diff whitespace checks green ·
  risk LOW
- 2026-06-30 · readme-cli-auth-artifact-refresh slice · refreshed
  [[README]] CLI prose to mention pull request artifact registration and the
  `session init` → `ACP_RPC_TOKEN` authenticated command flow · validation:
  format, lint, typecheck, file-size, and diff-check green · risk LOW
- 2026-06-30 · cli-authenticated-session-flow slice · added
  [[session-auth-flow-test]] proving `acp session init` plus [[cli-client]]
  bearer forwarding against a require-auth [[acp-router]], covering the
  authenticated CLI bootstrap path without a real socket · validation: format,
  lint, typecheck, file-size, focused CLI auth-flow test, and 284-test
  non-socket suite green · risk LOW
- 2026-06-30 · cli-session-bootstrap slice · added [[cli-session-commands]]
  with `acp session init` for `POST /v1/session/initialize`, letting
  authenticated CLI operators mint bearer sessions before exporting
  `ACP_RPC_TOKEN` while keeping token persistence outside ACP · validation:
  format, lint, typecheck, file-size, focused CLI parser tests, and 283-test
  non-socket suite green · risk LOW
- 2026-06-30 · cli-bearer-token-forwarding slice · taught [[cli-client]] and
  [[cli-main]] to forward `ACP_RPC_TOKEN` as `Authorization: Bearer ...` for
  normal CLI requests and SSE event streams, closing the authenticated-host CLI
  gap without printing bearer tokens · validation: format, lint, typecheck,
  file-size, focused CLI client tests, and 281-test non-socket suite green · risk
  LOW
- 2026-06-30 · github-pr-artifact-cli slice · added `acp artifact pr` as a
  CLI convenience that creates a normal external `pull_request` [[Artifact]]
  using `--url` as `uri`, giving v0.2 GitHub PR artifact evidence a narrow
  protocol projection without granting ACP GitHub permissions · validation:
  format, lint, typecheck, file-size, focused CLI parser tests, and 279-test
  non-socket suite green · risk LOW
- 2026-06-30 · rpc-route-bearer-helper-adoption slice · migrated
  [[native-rpc-route]] live HTTP client tests to use [[acp-rpc-client]]
  `withAcpRpcBearer` for unary generated-client calls, proving the bearer helper
  over the mounted route and removing repeated per-operation header objects ·
  validation: format, lint, typecheck, file-size, focused route/client tests, and
  277-test non-socket suite green · risk LOW
- 2026-06-30 · rpc-client-host-layer slice · added
  `acpRpcClientHostLayer(baseUrl)` as the common native RPC client protocol layer
  for host base URLs and migrated [[native-rpc-route]] live tests away from
  manual `/rpc/native` URL concatenation · validation: format, lint, typecheck,
  file-size, focused RPC client/route tests, and 277-test non-socket suite green
  · risk LOW
- 2026-06-30 · rpc-client-ergonomics slice · added native RPC client helpers for
  the mounted route path, host URL derivation, bearer headers, and
  `RpcClient.withHeaders` session scoping; made [[native-rpc-route]] reuse the
  exported path literal and added a focused generated-client regression proving
  scoped bearer calls work without per-operation header objects · validation:
  format, lint, typecheck, file-size, focused RPC client/route tests, and
  277-test non-socket suite green · risk LOW
- 2026-06-30 · audit-native-rpc-consumer-frontier slice · refreshed
  [[protocol-implementation-2026-06-28]] after the native transport spec update:
  JSON-RPC is compatibility framing rather than a deletion target, native Effect
  RPC is the first-party TypeScript transport, and the next code slice is client
  ergonomics for URL and bearer-session handling · validation: format, lint,
  typecheck, file-size, and diff whitespace green · risk LOW
- 2026-06-30 · spec-native-rpc-transport-guidance slice · updated
  [[specs.md]] transport guidance to keep HTTP/SSE as the cross-language MVP,
  name JSON-RPC as stdio/WebSocket compatibility framing, document native Effect
  RPC as a first-party TypeScript reference transport, and close the stale
  JSON-RPC-vs-HTTP/SSE open question · validation: format, lint, typecheck,
  file-size, diff whitespace, and 275-test non-socket suite green · risk LOW
- 2026-06-30 · readme-native-rpc-current-surface slice · refreshed
  [[README]] prose to include `/rpc/native`, generated Effect RPC client
  coverage, native RPC structured telemetry, and the compatibility role of
  JSON-RPC/stdout bridges without turning the README into a feature checklist ·
  validation: format, lint, typecheck, file-size, diff whitespace, and 275-test
  non-socket suite green · risk LOW
- 2026-06-30 · cli-parseargs-dispatch-table slice · refactored
  [[cli-commands]] argument tokenization from nested conditionals to an
  extensible token parser registry while preserving the existing command handler
  table; added a regression proving a valueless flag followed by another flag is
  not consumed as a value · validation: format, lint, typecheck, file-size,
  focused CLI parser tests, and 275-test non-socket suite green · risk LOW
- 2026-06-30 · rpc-structured-telemetry slice · added
  [[rpc-telemetry-middleware]] as a wrap-style native RPC middleware using
  Effect log spans and annotations to emit one structured completion log per
  operation with operation, client id, outcome, duration, failure class, and
  ACP error code when available; attached telemetry after auth on scoped calls
  and directly on `session.initialize`; added a contract regression that every
  native RPC operation carries telemetry · validation: format, lint, typecheck,
  file-size, focused RPC telemetry/route tests, and 274-test non-socket suite
  green · risk LOW
- 2026-06-30 · rpc-http-work-lease-roundtrip slice · extended
  [[native-rpc-route]] live-socket coverage with worker lookup, workspace
  update/archive, work claim/state transition, and lease request/renew/release/
  revoke over the mounted NDJSON HTTP transport, closing expanded mounted-route
  parity for all native RPC handler verticals · validation: focused live native
  route test green · risk LOW
- 2026-06-30 · rpc-http-review-memory-roundtrip slice · extended
  [[native-rpc-route]] live-socket coverage with review request/approve, memory
  create/list, work event publish, and unary `events.list` over the mounted
  NDJSON HTTP transport, proving the review/memory/event vertical beyond
  `RpcTest` while leaving streaming coverage in the existing subscribe
  regression · validation: focused live native route test green · risk LOW
- 2026-06-30 · rpc-http-artifact-checkpoint-roundtrip slice · extended
  [[native-rpc-route]] live-socket coverage with artifact create/update/content/
  list and checkpoint create/latest round-trips over the mounted NDJSON HTTP
  transport, proving one split handler vertical beyond `RpcTest` against the
  real host route · validation: focused live native route test green · risk LOW
- 2026-06-30 · rpc-roundtrip-coverage slice · added generated-client native RPC
  round-trip coverage for the worker/workspace/work/lease,
  artifact/checkpoint, and review/memory/event verticals, extending
  [[acp-rpc-roundtrip-test]] from an initial workspace smoke into subsystem
  parity coverage against [[acp-rpc-server]]; added wiki mirrors for the
  round-trip test files and refreshed [[acp-rpc-client]]/[[acp-rpc-server]] to
  name the coverage boundary · validation: focused round-trip tests green ·
  risk LOW
- 2026-06-30 · post-rpc-aggregate-actor-bridge-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] with the contract-scope parity audit
  (37 scoped operations across all five RPC handler files compared against
  [[acp-rpc-contract]] annotations, zero drift) and recorded the decision to
  keep dual-layer handler-local + middleware authorization permanently rather
  than collapse to middleware-only, since `.middleware()` is attached at the
  `Rpc` definition (so every real `RpcServer` transport already runs
  [[rpc-auth-middleware]]) and the only bypass is the test-only `accessHandler`
  path — removing handler-local checks would silently void existing
  scope-denial regressions for zero production benefit; selected growing
  native RPC client coverage toward JSON-RPC method parity as the live
  frontier · docs-only validation: format, file-size, and diff whitespace
  checks green · risk LOW
- 2026-06-30 · effect-rpc-aggregate-actor-bridge slice · migrated
  [[acp-rpc-handlers]] (`session.initialize`/`worker.*`/`workspace.*`/`work.*`/
  `lease.*`) from `authorizeRpc` to [[rpc-auth]] `rpcActor`, completing the
  actor-bridge sweep across every native RPC handler vertical — no handler
  calls `authorizeRpc` directly anymore; added a `work.create` regression
  proving the middleware-provided actor short-circuits session lookup against a
  deliberately invalid bearer token; refreshed
  [[protocol-implementation-2026-06-28]] to select auditing contract-scope
  parity before considering dropping handler-local auth in favor of
  [[rpc-auth-middleware]] alone · validation: format, lint, typecheck,
  file-size, and 271 non-socket tests green · risk LOW
- 2026-06-30 · effect-rpc-checkpoint-review-actor-bridge slice · migrated
  [[acp-rpc-checkpoint-handlers]] and [[acp-rpc-review-handlers]] from
  `authorizeRpc` to [[rpc-auth]] `rpcActor`, preserving direct handler bearer
  fallback while allowing native middleware-provided `AcpRpcActor`; added
  `checkpoint.create` and `review.approve` regressions proving the
  middleware-provided actor short-circuits session lookup even with a
  deliberately invalid bearer token; refreshed
  [[protocol-implementation-2026-06-28]] to select the aggregate
  work/workspace/lease handler file as the last actor-bridge migration target ·
  validation: format, lint, typecheck, file-size, and 270 non-socket tests
  green · risk LOW
- 2026-06-30 · effect-rpc-artifact-actor-bridge slice · migrated
  [[acp-rpc-artifact-handlers]] to [[rpc-auth]] `rpcActor` for artifact mutation
  actor attribution and workspace-read checks, preserving direct handler bearer
  fallback while allowing native middleware-provided `AcpRpcActor`; added a
  direct artifact create regression without bearer headers · validation: format,
  lint, typecheck, file-size, focused RPC artifact actor bridge tests, and
  264-test non-socket suite green · risk LOW
- 2026-06-30 · effect-rpc-handler-actor-bridge slice · moved `AcpRpcActor` into
  [[rpc-auth]], added `rpcActor` as the middleware-aware handler bridge, migrated
  [[acp-rpc-memory-event-handlers]] to consume it for memory/event authorization
  and actor attribution, and added a direct handler regression proving
  middleware-provided actor context works without bearer headers · validation:
  format, lint, typecheck, file-size, focused RPC actor bridge tests, and
  263-test non-socket suite green · risk LOW
- 2026-06-30 · effect-rpc-event-subscribe-stream slice · added native
  `events.subscribe` as an `@effect/rpc` streaming operation over
  [[acp-rpc-contract]], backed it in [[acp-rpc-memory-event-handlers]] through
  [[event-store]] subscriptions, switched [[native-rpc-route]] and
  [[acp-rpc-client]] to NDJSON framing for streaming HTTP, and extended the live
  route regression to subscribe before publishing and observe the emitted event ·
  validation: format, lint, typecheck, file-size, focused RPC stream tests, and
  262-test non-socket suite green · risk LOW
- 2026-06-30 · effect-rpc-auth-middleware slice · added
  [[rpc-auth-middleware]] with `AcpRpcRequiredScope`, `AcpRpcActor`, and
  `AcpRpcAuthMiddlewareLive`; annotated secured [[acp-rpc-contract]] operations
  with their existing permission scopes; merged the middleware into
  [[acp-rpc-server]]; and extended the contract/native-route regressions for
  scope metadata plus over-HTTP denial · validation: format, lint, typecheck,
  file-size, focused RPC middleware/route/roundtrip tests, and 261-test
  non-socket suite green · risk LOW
- 2026-06-30 · effect-rpc-http-route-mount slice · mounted the native Effect RPC
  surface at `/rpc/native` through [[native-rpc-route]], moved [[http-app]] to
  `HttpLayerRouter.serve(AcpHttpRoutesLive)`, split [[acp-rpc-server]] into a
  host-shared `AcpRpcHandlersLayer` and standalone `AcpRpcHandlersLive`, and
  added a live TCP regression proving the generated client writes state visible
  through REST with the same bearer session · validation: format, lint,
  typecheck, file-size, focused live socket tests, and 260-test non-socket suite
  green · risk LOW
- 2026-06-30 · effect-rpc-transport-wiring slice · stood up the native RPC
  transport seam — [[acp-rpc-server]] (`AcpRpcHandlersLive`, handlers ⊕ AppLive ⊕
  IdClockLive, requirement `never`), [[acp-rpc-client]] (generated typed
  `makeAcpRpcClient` + `acpRpcClientHttpLayer` JSON streaming-HTTP protocol), and
  [[acp-rpc-roundtrip-test]] proving a real `RpcTest` client round-trip
  (encode→serialize→handler→typed decode) including per-call bearer auth and a
  typed `unauthorized` denial; refreshed [[protocol-implementation-2026-06-28]] to
  select host RpcServer HTTP-route mounting as the next slice · validation:
  format, lint, typecheck, file-size, and 263 non-socket tests green · risk LOW
- 2026-06-30 · effect-rpc-memory-event-handlers slice · added
  [[acp-rpc-memory-event-handlers]] and merged it into [[acp-rpc-handlers]] for
  native `memory.create`/`memory.list` over [[memory-service]] and `events.list`
  replay over the [[event-store]] — closing the last [[acp-rpc-contract]]
  coverage gap so every contract request now has a backing handler; refreshed
  [[protocol-implementation-2026-06-28]] to select native RpcServer/RpcClient
  transport wiring as the next slice · validation: format, lint, typecheck,
  file-size, and 262 non-socket tests green · risk LOW
- 2026-06-30 · effect-rpc-review-handlers slice · added
  [[acp-rpc-review-handlers]] and merged it into [[acp-rpc-handlers]] for native
  review request/outcome/cancel/list handlers over [[review-service]] · focused
  validation: format, lint, typecheck, file-size, focused RPC tests, and 257
  non-socket tests green · risk LOW
- 2026-06-30 · post-rpc-checkpoint-handlers-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after
  [[acp-rpc-checkpoint-handlers]] and selected native review request/outcome/list
  handlers as the next direct-RPC human-gate vertical · docs-only validation
  green: format, file-size, and diff whitespace checks · risk LOW
- 2026-06-30 · effect-rpc-checkpoint-handlers slice · added
  [[acp-rpc-checkpoint-handlers]] and merged it into [[acp-rpc-handlers]] for
  native `checkpoint.create`, work/workspace checkpoint lists, and latest
  checkpoint reads over [[checkpoint-service]] · validation: format, lint,
  typecheck, file-size, focused RPC tests, and 256 non-socket tests green · risk
  LOW
- 2026-06-30 · post-rpc-artifact-handlers-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after [[acp-rpc-artifact-handlers]] and
  selected `checkpoint.create`/`checkpoint.list_for_work`/
  `checkpoint.latest_for_work`/`checkpoint.list_for_workspace` as the next
  direct-RPC resume vertical · validation: format, file-size, and diff
  whitespace checks green · risk LOW
- 2026-06-30 · effect-rpc-artifact-handlers slice · added
  [[acp-rpc-artifact-handlers]] and merged it into [[acp-rpc-handlers]] for
  native `artifact.create`/`artifact.update`/`artifact.delete`/
  `artifact.content`/artifact list handlers over [[artifact-service]] · focused
  validation: format, lint, typecheck, file-size, focused RPC tests, and 255
  non-socket tests green · risk LOW
- 2026-06-30 · post-rpc-lease-handlers-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after native lease RPC handlers and
  selected `artifact.create`/`artifact.update`/`artifact.delete`/
  `artifact.content`/artifact list handlers as the next direct-RPC evidence
  slice · validation: format, file-size, and diff whitespace checks green · risk
  LOW
- 2026-06-30 · effect-rpc-lease-handlers slice · expanded
  [[acp-rpc-handlers]] with native `lease.request`, `lease.renew`,
  `lease.release`, and `lease.revoke` handlers over [[lease-service]], preserving
  TTL defaults, conflict checks, lifecycle events, and `lease.release` void
  success semantics · validation: format, lint, typecheck, file-size, focused
  RPC tests, and 254 non-socket tests green · risk LOW
- 2026-06-30 · post-rpc-work-handlers-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after the native work/workspace RPC
  handler vertical and selected `lease.request`/`lease.renew`/`lease.release`/
  `lease.revoke` as the next direct-RPC handler slice · validation: format,
  file-size, and diff whitespace checks green · risk LOW
- 2026-06-30 · effect-rpc-workspace-work-handlers slice · expanded
  [[acp-rpc-handlers]] with native workspace create/update/archive and work
  create/list/get/claim/update/event handlers over [[acp-rpc-contract]] ·
  validation: format, lint, typecheck, file-size, focused RPC tests, and 253
  non-socket tests green · risk LOW
- 2026-06-30 · post-rpc-handler-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after [[acp-rpc-handlers]] and selected
  native work/workspace command handlers as the next direct-RPC vertical ·
  docs-only validation · risk LOW
- 2026-06-30 · effect-rpc-handler-vertical slice · added
  [[acp-rpc-handlers]], [[rpc-auth]], and [[rpc-error]] for native
  `session.initialize`, `worker.list/get`, and `workspace.list` direct handler
  coverage over [[acp-rpc-contract]] · 252 non-socket tests green · risk LOW
- 2026-06-30 · post-rpc-contract-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after [[acp-rpc-contract]] and selected
  the first native handler/auth vertical for session initialization plus
  worker/workspace reads · docs-only validation · risk LOW
- 2026-06-30 · effect-rpc-contract-foundation slice · added
  [[acp-rpc-contract]] source with an `@effect/rpc` `AcpRpcGroup` covering the
  current non-streaming ACP operation set and a registry test for the closed tag
  surface; handlers/auth/client/streaming remain later slices · 250 non-socket
  tests green · risk LOW
- 2026-06-30 · effect-rpc-dependency-preflight slice · made `@effect/rpc`
  explicit in package metadata, pinned the SDK in [[grammar/typescript]], and
  created the planned [[acp-rpc-contract]] wiki page before native RPC source
  imports · format/lint/typecheck/file-size green without running install · risk LOW
- 2026-06-30 · observability-request-logging slice · extended
  [[route-support]] with Effect request lifecycle logs using stable route
  templates, response status, duration, and protocol error code while preserving
  no-body/no-token/no-id logging boundaries across [[acp-router]] and split route
  modules · 252 tests green · risk LOW
- 2026-06-29 · cli-command-map-split follow-up · split shared CLI parser
  primitives into [[cli-command-support]] and moved event/memory handlers into
  [[cli-event-commands]] and [[cli-memory-commands]], preserving `parseArgs`
  while bringing oversized parser/test files back under the repository size
  gate for PR #106 · focused validation pending · risk LOW
- 2026-06-29 · post-effect-rpc-adr-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after
  [[ADR-0007-effect-rpc-adoption]] and selected the initial `@effect/rpc`
  RpcGroup/handler implementation stage before deleting JSON-RPC · docs-only
  validation · risk LOW
- 2026-06-29 · effect-rpc-adoption-decision slice · wrote
  [[ADR-0007-effect-rpc-adoption]] to adopt `@effect/rpc` over the domain services
  and retire the hand-mapped JSON-RPC layer ([[json-rpc-command-map]] et al.),
  given first-party Effect/TS clients; superseded the framing in
  [[ADR-0002-json-rpc-transport-framing]] and the client deferral in
  [[ADR-0004-protocol-version-codecs-generated-client]]; registered in
  [[decisions/_MOC]] · docs-only, direction not yet implemented · risk LOW
- 2026-06-29 · workspace-memory-transport slice · projected [[Memory]] through
  REST, JSON-RPC, and the CLI: [[memory-routes]] (`POST /v1/memory`,
  `GET /v1/memory`) behind `memory:create`/`memory:read` with the API contract
  split into [[acp-http-api-memory]]; [[json-rpc-memory-commands]] mapping
  `memory.create`/`memory.list`; and `memory create`/`memory list` CLI commands.
  Fixed the WIP UrlParams `nullable` encode error and a latent double-decode in
  the list handler · 252 tests green · risk LOW
- 2026-06-29 · post-memory-core-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after workspace [[Memory]] core and
  selected REST/JSON-RPC/CLI memory projection with route/API file splitting as
  the next slice · docs-only validation · risk LOW
- 2026-06-29 · workspace-memory-core slice · added [[Memory]] protocol schema,
  storage seam operations, optimized SQLite/in-memory backing, and
  [[memory-service]] creation/read behavior with `memory.created` event emission
  · 241 non-socket tests green · risk LOW
- 2026-06-29 · post-memory-foundation-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after [[Memory]] foundation and
  selected the workspace memory core implementation before transport projection
  · docs-only validation · risk LOW
- 2026-06-29 · workspace-memory-foundation slice · added tracked
  `@root/specs.md` foundation and wiki anchors for [[Memory]] records,
  including `memory.created`, REST/JSON-RPC surfaces, `memory:create/read`
  scopes, and optimized SQLite cursor/index shape for thousands of records ·
  validation pending · risk LOW
- 2026-06-29 · post-open-questions-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after answered Open Questions cleanup
  and selected workspace memory records foundation, including optimized SQLite
  query shape and route/API file split planning, as the next slice · docs-only
  validation · risk LOW
- 2026-06-29 · spec-open-questions-cleanup slice · converted answered
  `@root/specs.md` Open Questions for advisory leases and dual-mode artifacts
  into resolved v0.1 notes while leaving memory, Git extensions, signed reviews,
  transport default, and offline sync as open · validation pending · risk LOW
- 2026-06-29 · post-roadmap-status-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after the tracked spec roadmap status
  refresh and selected answered Open Questions cleanup for advisory leases and
  dual-mode artifacts · docs-only validation · risk LOW
- 2026-06-29 · spec-roadmap-status-refresh slice · moved implemented JSON-RPC
  transport and closed permissions into the `@root/specs.md` v0.1 roadmap
  surface and reframed the JSON-RPC open question around default recommendation
  rather than existence · validation pending · risk LOW
- 2026-06-29 · post-permission-vocabulary-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after tracked spec permission
  vocabulary parity and selected `@root/specs.md` roadmap/open-questions
  refresh as the next docs slice · docs-only validation · risk LOW
- 2026-06-29 · spec-permission-vocabulary-parity slice · aligned
  `@root/specs.md` authentication with the closed v0.1 [[common]]
  permission vocabulary and replaced the stale bearer-token placeholder with
  ACP naming · validation pending · risk LOW
- 2026-06-29 · post-spec-review-cancellation-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after tracked spec review
  cancellation parity and selected `@root/specs.md` permission vocabulary
  parity as the next docs slice · docs-only validation · risk LOW
- 2026-06-29 · spec-review-cancellation-parity slice · aligned tracked
  `@root/specs.md` with implemented review cancellation by documenting
  `review.cancelled`, `POST /v1/reviews/{review_id}/cancel`, JSON-RPC
  `review.cancel`, the `needs_review -> running` withdrawal path, and the CLI
  cancel example · validation pending · risk LOW
- 2026-06-29 · post-readme-refresh-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after README current-surface updates
  and selected tracked `specs.md` review-cancellation parity as the next docs
  slice · docs-only validation · risk LOW
- 2026-06-29 · readme-current-surface-refresh slice · refreshed README prose for
  review cancellation transport parity, the tracked `specs.md` draft, and the
  current `src/infrastructure/platform-node` adapter boundary · validation
  pending · risk LOW
- 2026-06-29 · post-section-numbering-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after stable `specs.md` numbering and
  selected a README refresh for review cancellation, tracked specs, and
  platform-node adapter wording · docs-only validation · risk LOW
- 2026-06-29 · spec-section-numbering-cleanup slice · fixed duplicate late
  headings in `@root/specs.md` so Relationship to MCP, roadmap, CLI examples,
  open questions, pitch, and protocol naming have stable unique section numbers
  · validation pending · risk LOW
- 2026-06-29 · post-spec-canonicalization-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after tracked `specs.md`
  canonicalization and selected duplicate late-section numbering cleanup as the
  next docs slice · docs-only validation · risk LOW
- 2026-06-29 · spec-canonicalization-cleanup slice · updated `@root/specs.md`
  to use Agent Coordination Protocol (ACP) terminology, `ACP_` examples, and
  `acp://` examples in normative sections; replaced the nonexistent
  `github.com/acme/web.git` sample with `example.com/acp/project.git` and
  refreshed [[spec-canonicalization]] · validation pending · risk LOW
- 2026-06-29 · post-process-io-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after [[node-process-io]], closing the
  process IO platform-node gap and selecting public `specs.md` canonicalization
  to remove Hadoof-era terminology and the nonexistent `acme/web` example ·
  docs-only validation · risk LOW
- 2026-06-29 · platform-node-process-io slice · added
  [[node-process-io]] so argv, stdin, and stdout access lives under
  `src/infrastructure/platform-node`; [[cli-main]] now parses `nodeArgv()` and
  [[stdio-main]] reads/writes frames through the adapter while preserving stdout
  protocol behavior · validation pending · risk LOW
- 2026-06-29 · post-platform-node-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after [[node-http-server]], closing the
  Node HTTP socket boundary gap and selecting process IO extraction for
  [[cli-main]] and [[stdio-main]] as the next platform-node slice · docs-only
  validation · risk LOW
- 2026-06-29 · platform-node-http-server-layer slice · added
  [[node-http-server]] and [[platform-node-index]] so the Node HTTP socket Layer
  lives under `src/infrastructure/platform-node`; [[server-main]] now launches
  [[http-app]] by providing that adapter, and real-socket server tests reuse the
  same factory with an ephemeral port · focused validation pending · risk LOW
- 2026-06-29 · post-review-cancellation-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after [[Review]] cancellation,
  confirming `review.cancelled` transport parity and selecting a narrow
  `src/infrastructure/platform-node` HTTP server Layer extraction as the next
  spec-aligned architecture slice · docs-only validation · risk LOW
- 2026-06-29 · review-cancellation-lifecycle slice · added
  `review.cancelled` to [[event.schema]], implemented [[review-service]]
  `cancel` for requested reviews, returned the associated [[WorkUnit]] to
  `running`, and projected cancellation through REST, JSON-RPC, and
  [[cli-commands]] with a dedicated `review:cancel` scope; split
  [[acp-http-api-events]] out of the REST contract to keep the central API file
  within the source-size budget · focused Vitest gate green · risk LOW
- 2026-06-29 · post-event-replay-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after workspace [[Event]] replay reads,
  closing stale replay-gap language and selecting [[Review]] cancellation
  lifecycle plus `review.cancelled` event vocabulary as the next bounded
  protocol gap · docs-only validation · risk LOW
- 2026-06-29 · workspace-event-replay-reads slice · projected [[event-store]]
  `readAfter(workspace_id, after_seq)` through [[event-routes]],
  [[acp-http-api]], [[json-rpc-event-commands]], and [[cli-commands]] with
  dedicated `event:read` scope so recovering agents can replay persisted
  workspace [[Event]] history before opening live subscriptions · 233 tests
  green · risk LOW
- 2026-06-29 · post-websocket-events-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after WebSocket `events.subscribe`,
  closing stale live-transport deferral language and selecting workspace
  [[Event]] replay reads over the existing `(workspace_id, seq)` storage shape as
  the next recovery gap · docs-only validation · risk LOW
- 2026-06-29 · websocket-event-subscriptions slice · lifted the JSON-RPC
  `events.subscribe` WebSocket deferral in [[rpc-socket]], delivering persisted
  workspace [[Event]]s as `events.event` notifications while keeping `POST /rpc`
  request/response-only and preserving SSE as the HTTP live channel · 229 tests
  green · risk LOW
- 2026-06-29 · post-worker-presence-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after host-scoped [[Worker]] registry
  reads, closing the stale next-slice language and selecting JSON-RPC
  `events.subscribe` semantics over WebSocket as the next live-transport gap ·
  docs-only validation · risk LOW
- 2026-06-29 · host-worker-presence-reads slice · projected host-scoped
  [[Worker]] registry reads through [[worker-routes]], [[acp-http-api]],
  [[json-rpc-worker-commands]], and [[cli-commands]] with dedicated
  `worker:read` scope, preserving [[ADR-0005-worker-presence-scope]] by keeping
  presence out of workspace [[Event]] logs · 228 tests green · risk LOW
- 2026-06-29 · post-websocket-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after README lease refresh and
  [[rpc-socket]], closing stale WebSocket deferral language and selecting
  host-scoped worker presence reads as the next protocol gap · docs-only
  validation · risk LOW
- 2026-06-29 · websocket-transport slice · added [[rpc-socket]] mounting a
  `GET /rpc` WebSocket upgrade beside `POST /rpc`, reusing the in-process router
  via the shared `dispatchVia` ([[rpc-endpoint]]) so WebSocket, HTTP, and REST
  share one store; connection-bound bearer (handshake header or `?token=`),
  request/response only (SSE keeps live events). Partially supersedes
  [[ADR-0002-json-rpc-transport-framing]]; updated [[Transport]] and README ·
  223 tests green (real-socket round-trip + parse-error) · risk LOW
- 2026-06-29 · readme-lease-lifecycle slice · refreshed the public README to
  name the `POST /v1/leases/:lease_id/renew` and `/revoke` routes, the
  `lease.renew`/`lease.revoke` JSON-RPC methods, the `lease renew`/`lease revoke`
  CLI commands, and the dedicated `lease:renew`/`lease:revoke` scopes ·
  docs-only validation, 221 tests green · risk LOW
- 2026-06-28 · post-lease-lifecycle-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after lease renew/revoke transport
  parity and selected the public README refresh as the next docs correction ·
  docs-only validation · risk LOW
- 2026-06-28 · lease-lifecycle-transport-parity slice · projected
  [[lease-service]] renew/revoke through [[acp-router]], [[acp-http-api]],
  [[json-rpc-command-map]], and [[cli-commands]] with dedicated `lease:renew`
  and `lease:revoke` scopes; split [[cli-usage]] out of the parser to keep the
  CLI command registry under the file-size gate · 221 tests green · risk LOW
- 2026-06-28 · post-aggregate-read-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after workspace aggregate resume reads
  and selected lease renew/revoke transport parity as the next backed-command
  gap · docs-only validation · risk LOW
- 2026-06-28 · workspace-aggregate-resume-reads slice · projected workspace
  checkpoint, artifact, and review aggregate reads through [[workspace-routes]],
  [[acp-http-api]], [[json-rpc-resume-commands]], and [[cli-commands]] so
  dashboards and supervising agents can inspect resumability evidence without
  iterating every WorkUnit id · 217 tests green · risk LOW
- 2026-06-28 · post-work-index-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after workspace work indexing and
  selected workspace-scoped checkpoint, artifact, and review aggregate reads as
  the next integration gap · docs-only validation · risk LOW
- 2026-06-28 · workspace-work-index-reads slice · added
  [[work-unit-service]] workspace indexing and projected
  `GET /v1/workspaces/{workspace_id}/work` through [[workspace-routes]],
  [[acp-http-api]], [[json-rpc-resume-commands]], and [[cli-commands]] so workers
  can discover current WorkUnit ids before calling resume reads · 212 tests
  green · risk LOW
- 2026-06-28 · post-resume-read-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after review/content resume reads and
  selected a workspace work index read as the next public discoverability gap ·
  docs-only validation · risk LOW
- 2026-06-28 · review-resume-content-reads slice · projected work review reads
  and host-stored artifact content reads through [[resume-routes]],
  [[acp-http-api]], [[json-rpc-resume-commands]], and [[cli-commands]] so resume
  clients can fetch review gates and private artifact content without replaying
  events · 208 tests green · risk LOW
- 2026-06-28 · post-observability-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after work resume reads and Effect
  logging, selecting work review reads plus host-stored artifact content reads
  as the next public resumability gap · docs-only validation · risk LOW
- 2026-06-28 · effect-observability-logging slice · added [[app-logging]] as the
  Effect JSON logger boundary for [[server-main]], with `ACP_LOG_LEVEL` mapped to
  Effect runtime levels, server annotations/spans, and sweeper health counts
  while preserving CLI/stdio stdout contracts · 204 tests green · risk LOW
- 2026-06-28 · work-resume-query-endpoints slice · added work-scoped resume
  reads across [[acp-http-api]], [[resume-routes]], [[json-rpc-resume-commands]],
  and [[cli-commands]] for current work metadata, checkpoints, latest checkpoint,
  and artifacts · focused route/JSON-RPC/CLI tests green · risk LOW
- 2026-06-28 · post-artifact-reference-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after external artifact URI support and
  selected work-centric resume query endpoints for [[WorkUnit]],
  [[Checkpoint]], and [[Artifact]] as the next integration slice · docs-only
  validation · risk LOW
- 2026-06-28 · external-artifact-references slice · added optional external
  artifact `uri` support across [[artifact.schema]], [[artifact-service]],
  [[acp-router]], [[json-rpc-command-map]], and [[cli-commands]], preserving
  host-stored `acp://artifacts/{id}` content as the default and rejecting empty
  artifact creates · 194 tests green · risk LOW
- 2026-06-28 · post-parser-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after the CLI parser dispatch-table
  refactor, confirmed SQLite hot paths already use composite primary-key query
  shapes for large local coordination state, and selected external artifact URI
  support as the next integration slice · docs-only validation · risk LOW
- 2026-06-28 · cli-parser-dispatch-table slice · refactored [[cli-commands]]
  from a linear `(group, action)` conditional chain into an additive command
  handler registry while preserving request mapping, validation, and unknown
  command errors · 188 tests green · risk LOW
- 2026-06-28 · readme-current-state-refresh slice · refreshed the public
  README prose for current REST/SSE, `POST /rpc`, stdio JSON-RPC, SQLite,
  scoped mutation permissions, and expanded CLI behavior · docs-only validation ·
  risk LOW
- 2026-06-28 · post-permission-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after permission scope parity and
  selected public README current-state drift as the next docs slice · docs-only
  validation · risk LOW
- 2026-06-28 · permission-scope-parity slice · expanded [[common]] session
  permission scopes and required explicit action scopes in [[acp-router]] for
  backed work, lease, artifact, and review mutations · 188 tests green · risk LOW
- 2026-06-28 · post-cli-integration-audit slice · refreshed
  [[protocol-implementation-2026-06-28]] after CLI parity and selected permission
  scope parity for backed mutations as the next implementation gap · docs-only
  validation · risk LOW
- 2026-06-28 · cli-backed-command-parity slice · expanded [[cli-commands]] and
  [[cli-client]] across backed workspace, artifact, and review action routes,
  including DELETE support for artifact removal · 187 tests green · risk LOW
- 2026-06-28 · protocol-audit-refresh slice · added
  [[protocol-implementation-2026-06-28]], refreshed the implementation coverage
  after the latest lifecycle/ADR slices, and selected CLI parity for backed
  commands as the next implementation gap · docs-only validation · risk LOW
- 2026-06-28 · worker-presence-event-scope slice · accepted
  [[ADR-0005-worker-presence-scope]], closing worker presence as host-scoped
  registry state for v0.1 rather than workspace event history, and refreshed the
  event/audit wiki graph around that boundary · docs-only validation · risk LOW
- 2026-06-28 · artifact-update-lifecycle slice · specified [[Artifact]] update
  as stable-identity metadata/content replacement, added `artifact.updated` as a
  backed [[artifact-service]] event, and projected REST/JSON-RPC route mirrors ·
  176 tests green · risk LOW
- 2026-06-28 · json-rpc-command-map-capacity slice · extracted
  [[json-rpc-command-support]] for shared JSON-RPC ids, errors, response shapes,
  param decoding, raw-body validation, and path encoding; [[json-rpc-command-map]]
  is back under the file-size headroom before more method growth · focused tests
  green · risk LOW
- 2026-06-28 · workspace-archive-lifecycle slice · added persisted
  [[Workspace]] lifecycle state for `active`/`archived`, specified archive as a
  one-way [[workspace-service]] transition, and exposed `workspace.archived` through
  REST/JSON-RPC route mirrors · 171 tests green · risk LOW
- 2026-06-27 · workspace-transport-commands slice · exposed backed
  [[Workspace]] create/update through REST and JSON-RPC, added `workspace:write`,
  split shared server route helpers into [[route-support]], and moved workspace
  handlers into [[workspace-routes]] to keep the router under the file-size gate ·
  focused tests pending · risk LOW
- 2026-06-27 · protocol-version-handshake slice · accepted
  [[ADR-0004-protocol-version-codecs-generated-client]], added
  [[protocol-version]] as the canonical v0.1 compatibility module, and moved
  unsupported session versions into explicit handshake validation while deferring
  standalone codecs/generated clients until a real boundary or consumer exists ·
  focused tests pending · risk LOW
- 2026-06-27 · format-drift-cleanup slice · normalized the pre-existing
  repo-wide Prettier drift across the lockfile and older wiki pages, then enabled
  `pnpm format:check` in CI beside lint, typecheck, file-size, and tests ·
  repo-wide format check green · risk LOW (mechanical)
- 2026-06-27 · ci-local-validation-gates slice · added GitHub Actions CI for
  Node 24 pull requests and `main` pushes, running lint, typecheck,
  `check:file-size`, and tests through the lockfile-backed pnpm setup · local
  workflow syntax/readability validation · risk LOW
- 2026-06-27 · json-rpc-command-map split · moved JSON-RPC method-to-HTTP command
  mapping into [[json-rpc-command-map]], reduced [[json-rpc]] to the public
  envelope/response facade, and added `check:file-size` via
  `scripts/check-file-size.mjs` · 160 tests green · risk LOW
- 2026-06-27 · fresh-protocol-implementation-audit slice · added
  [[protocol-implementation-2026-06-27]], replacing the stale gap list with a
  current audit that names the JSON-RPC file-size violation and missing
  `check:file-size` gate as the next implementation target · docs-only validation
  · risk LOW
- 2026-06-27 · spec-naming-canonicalization slice · added
  [[spec-canonicalization]] as the tracked rule for reading the ignored Hadoof-era
  draft through ACP naming, `ACP_` env vars, and `acp://` URIs without mutating
  `@root/specs.md` · docs-only validation · risk LOW
- 2026-06-27 · event-vocabulary-domain-decisions slice · accepted
  [[ADR-0003-event-vocabulary-domain-boundaries]], binding public event emission
  to persisted domain transitions and deferring worker presence, workspace
  archive, and artifact update until their domain models exist · docs-only
  validation · risk LOW
- 2026-06-27 · artifact-delete-transport slice · exposed backed artifact removal
  through `DELETE /v1/artifacts/{artifact_id}` and JSON-RPC `artifact.delete`,
  preserving `artifact.deleted` event emission in [[artifact-service]] and leaving
  artifact update pending until the domain grows mutation semantics · focused
  transport tests, lint, and typecheck green; full suite blocked by environment
  usage limit before commit · risk LOW
- 2026-06-27 · session-capability-negotiation slice · accepted the draft §9
  `session.initialize` request shape (`protocol_version`, lean worker descriptor,
  client capability flags) alongside the existing full-worker payload, normalizing
  both into the stored [[Worker]] record while preserving scoped session
  permissions · 157 tests green · risk LOW
- 2026-06-27 · review-action-transport slice · exposed review decisions through
  REST (`approve`, `reject`, `request_changes`) and JSON-RPC
  (`review.approve`, `review.reject`, `review.request_changes`) using the bearer
  session actor, with router, `/rpc`, mapper, and HTTP contract tests · 154 tests
  green · risk LOW
- 2026-06-27 · json-rpc-progress-event slice · added `work.publish_event` to
  [[json-rpc]] as the command-parity alias for REST
  `POST /v1/work/{work_id}/events`, including path encoding, schema-backed event
  params validation, `/rpc` integration coverage, and audit/dashboard updates ·
  151 tests green · risk LOW
- 2026-06-27 · protocol-coverage-audit slice · added
  [[protocol-coverage-2026-06-27]] comparing `specs.md` v0.1 to the current
  implementation. Covered schemas/domain/storage/REST/JSON-RPC/runtime standards,
  identified event vocabulary and review-action gaps, and selected JSON-RPC
  progress publication as the next command-parity slice · docs-only · risk LOW
- 2026-06-27 · websocket-evaluation slice · accepted
  [[ADR-0002-json-rpc-transport-framing]]: v0.1 JSON-RPC ships over `POST /rpc`
  and stdio Content-Length framing; WebSocket is deferred until server upgrade,
  auth, event subscription, heartbeat, backpressure, and disconnect semantics are
  specified. Updated [[Transport]], [[EventStream]], decisions MOC, and build
  order · docs-only · risk LOW · [[ADR-0002-json-rpc-transport-framing]]
- 2026-06-27 · json-rpc-stdio slice · added a stdio JSON-RPC bridge:
  [[stdio-frames]] Content-Length byte codec with partial-frame and UTF-8 tests,
  [[stdio-main]] forwarding complete frames to `POST /rpc`, `ACP_RPC_TOKEN`
  bearer forwarding, `acp-jsonrpc-stdio` package binary, stdio MOC, and
  [[Transport]] seam status update · 149 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-27 · readme-canonicalization slice · refreshed the public README to
  match the current host: storage seam with memory/SQLite adapters, local versus
  required bearer auth, JSON-RPC core versus future runtime hosts, current smoke
  commands, and expected Node SQLite warning · 130 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-27 · json-rpc-transport-core slice · projected spec §13 JSON-RPC
  methods to code: [[jsonrpc-index]], [[json-rpc]] envelope parsing, closed
  method table, schema-backed params validation, canonical HTTP route mapping,
  path encoding, SSE stream mapping for `events.subscribe`, notification-aware
  success responses, JSON-RPC error helpers, and JSON-RPC MOC · 130 tests green ·
  risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-25 · vault · FMCF Mode 1 scaffold: grammar, domain glossary (8),
  [[architecture/LANGUAGE]], seams (Storage/Transport/EventStream), MOCs ·
  risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-25 · protocol-schema slice · projected schema pages to code: branded
  [[ids]], [[common]] vocabularies, 8 entity schemas, [[event.schema]],
  [[error.schema]], tagged [[protocol-error]] (total spec §15 mapping), [[app-config]]
  (typed ACP\_\* config, orDie on invalid) · 14 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-25 · storage slice · projected [[Storage]] seam to code: [[storage-index]],
  [[storage]] port, [[in-memory-store]] adapter, storage MOCs, and adapter tests for
  KV state plus append-only per-workspace [[Event]] seqs · 20 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · event-store slice · projected [[EventStore]] to code:
  [[event-store-index]], [[event-store]] service, domain events MOCs, and tests for
  append seqs, read-after replay, empty replay, and scoped workspace-filtered live
  PubSub delivery · 24 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · work-unit slice · projected [[WorkUnit]] lifecycle to code:
  [[work-unit-service-index]], [[work-unit-service]] service, WorkUnit MOCs, and
  tests for create, claim, review-loop transition, invalid transitions, missing
  work, ordered event emission, and `changes_requested` schema decode · 31 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · http-transport slice · projected [[Transport]] HTTP contract to
  code: [[http-index]], [[acp-http-api]] Effect Platform API declaration,
  [[http-error-mapper]] JSON protocol error mapper, HTTP MOC, and tests for
  reflected v0.1 routes plus status/no-leak error responses · 34 tests green ·
  risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-26 · sse-event-stream slice · projected [[EventStream]] SSE adapter to
  code: [[sse-index]], [[sse-event-stream]] frame/byte/response rendering,
  heartbeat comments from [[app-config]], SSE MOC, and tests for event frames,
  UTF-8 output, response metadata, and heartbeat shape · 38 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · worker-service slice · projected the [[Worker]] registry to code:
  [[worker-service-index]], [[worker-service]] service (register upsert, get, list,
  setStatus), workers MOC, and tests for register/read-back, upsert overwrite,
  missing-worker none, list, status update, and `NotFoundError` on missing.
  Grill-resolved: no per-workspace presence events this slice (Worker is
  host-scoped; deferred to a future host event stream) · 44 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · naming · renamed the HTTP API drift `HadoofHttpApi`/`hadoof-http-api`
  → `AcpHttpApi`/`acp-http-api` (`HttpApi.make('acp')`) per
  [[ADR-0001-architecture-foundation]] §Decision-1 (canonical name ACP); mirrored
  page [[acp-http-api]] + all wikilinks updated; historical "Hadoof" mentions kept
  only in the ADR/INDEX as rejected-name context · 44 tests green · risk LOW
- 2026-06-26 · workspace-service slice · projected the [[Workspace]] registry to
  code: [[workspace-service-index]], [[workspace-service]] service (create, get,
  list, update) emitting `workspace.created`/`workspace.updated` through
  [[EventStore]], workspaces MOC, and tests for create+event, list, update+event,
  missing-workspace none, and `NotFoundError` on update. Grill-resolved: Workspace
  emits its own events (it _is_ the per-workspace event scope); `workspace.archived`
  deferred (no lifecycle field in the wire schema) · 49 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · lease-service slice · projected the [[Lease]] lifecycle to code:
  [[lease-service-index]], [[lease-service]] service (request, get, list, renew,
  release, revoke, expireDue) with active-resource conflict detection, TTL from
  [[app-config]], `lease.*` events through [[EventStore]], leases MOC, and tests
  for grant+event, default TTL, conflict, renew, release/revoke, expiry sweep,
  missing lease, and expired renew rejection · 57 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · artifact-service slice · projected the [[Artifact]] registry to
  code: [[artifact-service-index]], [[artifact-service]] service (create, get,
  readContent, listForWork, listForWorkspace, remove) with host-stored
  `acp://artifacts/{id}` URIs, content-size validation from [[app-config]],
  `artifact.*` events through [[EventStore]], artifacts MOC, and tests for
  create+content+event, metadata-only artifacts, size rejection, list filters,
  removal+event, missing get, and missing remove · 64 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · checkpoint-service slice · projected the [[Checkpoint]] registry
  to code: [[checkpoint-service-index]], [[checkpoint-service]] service (create,
  get, listForWork, listForWorkspace, latestForWork) with append-only semantics,
  newest-first resume ordering, `checkpoint.created` events through
  [[EventStore]], checkpoints MOC, and tests for create+event, work/workspace
  filters, latest checkpoint, and missing checkpoint/latest none · 69 tests
  green · risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-26 · review-service slice · projected the [[Review]] gate to code:
  [[review-service-index]], [[review-service]] service (request, get,
  listForWork, listForWorkspace, approve, reject, requestChanges) with
  WorkUnit-backed workspace resolution, requirement validation, `review.*`
  events through [[EventStore]], reviews MOC, and tests for request+event+work
  transition, approve requirements, unmet requirement rejection, changes
  requested transition, list filters, and missing review · 75 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · app-live slice · projected application Layer composition to code:
  [[app-live-index]], [[app-live]] in-memory dependency graph wiring
  [[app-config]], [[Storage]], [[EventStore]], WorkUnit, Worker, Workspace,
  Lease, Artifact, Checkpoint, and Review services for future server/CLI
  entrypoints · 76 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · http-server slice · projected the HTTP transport entrypoint to code:
  [[id-clock]] id/timestamp primitive, [[acp-router]] `HttpRouter` binding all 12
  spec §12 routes to the domain services (decode → mint id/now → delegate → encode →
  total error→status map via [[http-error-mapper]]) plus the SSE stream via
  [[sse-event-stream]], [[server-main]] Node `NodeHttpServer` entrypoint on
  `ACP_PORT`, server MOC, and web-handler tests for initialize, list, create/claim
  work, 404s, and lease request/release. Grill-resolved: manual router (not
  HttpApiBuilder) to reuse the existing correct-status error mapper without touching
  the merged [[acp-http-api]] contract; fixed `worker_system` actor until auth ·
  83 tests green · risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-26 · cli slice · projected the local `acp` command-line client to code:
  [[cli-index]], [[cli-commands]] pure argv→HTTP request parser, [[cli-client]]
  Effect Platform `HttpClient` sender, [[cli-main]] Node runtime entrypoint, package
  `bin` wiring, CLI MOC, and parser tests for work, lease, checkpoint, artifact,
  review, and SSE stream commands. Grill-resolved: CLI remains an HTTP client of
  [[acp-router]] so discrete invocations share state through the local ACP host;
  route/query values are encoded at the parser boundary and TTLs fail locally
  before HTTP decoding · 97 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-26 · readme-foundation slice · replaced the stub README with a
  maintainer-facing project introduction covering ACP scope, current runtime shape,
  local validation/build commands, server/CLI smoke entrypoints, wiki-first design
  record, repository layout, and Apache-2.0 licensing; added `build` script for the
  documented `dist/` entrypoints and refreshed the architecture build-order ledger ·
  docs-only risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-26 · session-auth slice · projected session identity + bearer-token actor
  resolution to code (spec §8/§9): [[session.schema]], [[session-service]]
  (create, get, total `resolveActor`), sessions MOC; [[acp-router]] now mints a
  session at `initialize` (returning `session_id` + host capabilities, replacing the
  worker-echo response) and resolves the `Authorization: Bearer` actor for each
  mutation, falling back to `worker_system` when unauthenticated. Grill-resolved:
  the `session_id` is the v0.1 token (no separate secret), no expiry/scopes yet,
  `resolveActor` returns `Option` so the router owns auth policy · 102 tests green ·
  risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-26 · scoped-auth slice · enforced spec §8 permission scopes: added the
  closed [[common]] `Permission` vocabulary (7 scopes), `permissions` on
  [[session.schema]] + the `initialize` payload (default `[]`); [[acp-router]]
  `resolveActor`→`authorize(scope?)` now resolves the bearer session and gates each
  mutation — no token → `worker_system`, invalid token or missing scope →
  `401 unauthorized` (reusing [[protocol-error]] `UnauthorizedError`). Grill-resolved:
  scopes are a separate authorization set (not derived from §9 capabilities), and
  only _authenticated_ requests are enforced (unauthenticated still degrades to
  `worker_system`). · 104 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-27 · live-boot smoke-test slice · extracted the [[http-app]] seam
  (`HttpAppLive`: [[acp-router]] served over [[app-live]] + [[id-clock]], socket
  left as a residual requirement) so [[server-main]] and tests share one
  composition; [[server-main]] now launches it, [[server-index]] re-exports it.
  Added an end-to-end live-boot test that binds a real `NodeHttpServer` on an
  ephemeral port (`port: 0`) and round-trips `initialize` → scoped `createWork`
  over HTTP, proving the socket boot, bearer-token actor resolution, and spec §8
  scope enforcement all compose. Grill-resolved: a real ephemeral socket over the
  already-covered web-handler path, and an import-safe seam over importing
  [[server-main]] (whose module-scope `runMain` binds 4317 on import). · 105 tests
  green · risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-27 · expiry-sweeper slice · added the background TTL eviction daemon
  ([[sweeper]]): `sweepOnce` reads `now` from [[id-clock]], evicts sessions older
  than `config.sessionTtl` via new [[session-service]] `list`/`evictExpired`, and
  lapses every due active lease via new [[lease-service]] `expireAllDue` (scans all
  workspaces, emits `lease.expired`). `SweeperLive` `forkScoped`s the loop on
  `config.sweepInterval`, merged into [[http-app]] over the shared `AppLive` so the
  router and sweeper evict from one store. Added `ACP_SESSION_TTL` (1h) and
  `ACP_SWEEP_INTERVAL` (60s) to [[app-config]]. Grill-resolved: poll loop over
  per-entity timers; forked in the host scope (not a second `AppLive` in main, which
  would split-brain the store); lease lapse reuses the existing `lease.expired`
  event, session eviction emits none (host-local auth state). · 107 tests green ·
  risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-27 · mandatory-auth slice · added `ACP_REQUIRE_AUTH` to [[app-config]]
  and [[acp-router]] authorization policy: default local-host mode still degrades
  unauthenticated mutations to `worker_system`, while hardened mode rejects missing
  bearer sessions with `401 unauthorized`; `session/initialize` remains the open
  bootstrap route that mints the bearer token. Added config and router regression
  tests plus mirrored config/router notes for the runtime switch · 109 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-27 · sqlite-storage slice · added [[sqlite-store]] as the second
  production [[Storage]] adapter using Node 24 `node:sqlite`: `WITHOUT ROWID`
  keyed/event tables, prepared statements per Layer, WAL + `busy_timeout`, atomic
  `BEGIN IMMEDIATE` event appends, primary-key query-plan assertions for hot reads,
  large workspace tail replay, and file-backed reopen persistence tests. App host
  wiring remains InMemory by default; persistent host selection is the next slice ·
  118 tests green · risk MEDIUM (experimental Node SQLite API) ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-27 · storage-selection slice · added [[storage-live]] and app config
  `ACP_STORAGE_ADAPTER`/`ACP_SQLITE_PATH` so [[app-live]] can choose memory or
  [[sqlite-store]] without changing domain services. [[http-app]] now exposes
  `StorageError` as a startup error, and an app-level regression proves
  [[worker-service]] state persists across two SQLite-backed `AppLive` instances.
  Memory remains the default to avoid creating local database files unless
  configured · 119 tests green · risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-27 · json-rpc-runtime slice · added [[json-rpc-runtime]] (`executeJsonRpc`):
  executes the [[json-rpc]] canonical commands against the host via an injected,
  transport-agnostic `JsonRpcDispatch`, folding outcomes into JSON-RPC 2.0
  responses — request/notification correlation (notifications get no reply even on
  failure), batch handling (sendable-only, `-32600` for an empty batch), stream
  rejection (`events.subscribe` → `-32603`, use the SSE route), and HTTP-status →
  reserved-code mapping (`400`→`-32602`, other non-2xx→`-32603`, ACP error kept in
  `data`). Fixed a latent [[json-rpc]] bug: full-payload methods now forward the
  validated **wire** body (`validatedBody`) instead of the decoded Option-wrapped
  form, which is not serializable onto the HTTP API. Tested with a fake dispatch
  (folding rules) and the real [[acp-router]] web handler (`session.initialize` →
  scoped `work.create` round-trip; scope-denied → `-32603`). Grill-resolved: reuse
  the router via dispatch (no duplicate routing/auth); ship the execution core
  transport-agnostic before any stdio/WS/`POST /rpc` framing. · 138 tests green ·
  risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-27 · json-rpc-http slice · added the `POST /rpc` framing ([[rpc-endpoint]]),
  the first concrete transport over [[json-rpc-runtime]]: reads a JSON-RPC 2.0 payload
  (single/batch), supplies a `JsonRpcDispatch` that replays each command against the
  in-process [[acp-router]] (`HttpServerRequest.fromWeb` → run `v1Router` →
  `HttpServerResponse.toWeb`) in the shared service context, and returns the response
  JSON (`204` when all notifications, `-32700` for a non-JSON body). Split the router
  into `v1Router` (the `/v1` REST routes) and `acpRouter = v1Router + POST /rpc` so
  dispatch never recurses into `/rpc`; made [[json-rpc-runtime]] `executeJsonRpc`/
  `JsonRpcDispatch` generic over requirements `R` so a dispatch can run in a service
  context. Tested over the `acpRouter` web handler: round-trip, a `/rpc`-minted session
  authorizing a direct `/v1` call (proving one shared store), notification `204`, batch
  folding, unknown-method `-32601`, non-JSON `-32700`. Grill-resolved: replay the shared
  router (no second `AppLive` split-brain); dispatch into `v1Router` not `acpRouter`
  (acyclic). · 144 tests green · risk LOW · [[ADR-0001-architecture-foundation]]
