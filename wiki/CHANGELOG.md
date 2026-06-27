# Changelog

Temporal ledger of logic deltas (one line each). Forensic Guardian appends.

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
  only *authenticated* requests are enforced (unauthenticated still degrades to
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
