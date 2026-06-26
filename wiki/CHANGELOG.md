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
