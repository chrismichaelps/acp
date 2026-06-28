# Changelog

Temporal ledger of logic deltas (one line each). Forensic Guardian appends.

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
