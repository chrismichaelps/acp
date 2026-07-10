---
type: adr
status: ACCEPTED
date: 2026-07-02
tags: [adr, deployment, storage, event-broker, multi-tenancy, operations]
aliases: [ADR-0008, ADR-0008-deployment-storage-topology]
---

# ADR-0008 — Deployment & Storage Topology: One Binary, Config-Selected Seams

## Status

ACCEPTED — 2026-07-02. Builds on the seam topology of
[[ADR-0001-architecture-foundation]] (Storage/Transport seams) and the
Effect-native transport direction of [[ADR-0007-effect-rpc-adoption]].
The decision remains unchanged. Its reference implementation is substantially
landed; the status ledger below records the current realization without treating
deferred deployment products as shipped.

### Implementation status (2026-07-10)

| Capability                       | Status          | Current evidence and boundary                                                                                                                                                                                                   |
| -------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage seam                     | **Implemented** | `src/app/storage-live.ts` selects memory, SQLite, or Postgres; `src/infrastructure/storage/postgres-store.ts` supplies the network adapter and atomic per-workspace sequences.                                                  |
| EventBroker seam                 | **Partial**     | `src/app/event-broker-live.ts` selects `in-process` or `pg-notify`; `src/infrastructure/events/pg-notify-event-broker.ts` provides cross-replica fan-out. Redis is deferred.                                                    |
| Identity/auth seam               | **Partial**     | HTTP and native RPC authorize bearer session IDs, permission scopes, and optional `workspace_ids`; `ACP_REQUIRE_WORKSPACE_BINDINGS` makes bindings mandatory. External token issuance/resolution and OIDC are deferred.         |
| Named runtime profiles           | **Implemented** | `src/config/app-config.ts` defines `local`, `single-node`, `hosted`, and `self-host-ha` presets with explicit `ACP_*` overrides.                                                                                                |
| Reference Compose topologies     | **Partial**     | `docker-compose.yml` ships a SQLite daily-driver and Postgres/pg-notify HA profile. It deliberately overrides auth off for local dogfood; no managed-hosting manifest is shipped.                                               |
| Sweeper leadership and retention | **Implemented** | `src/app/server/sweeper-leadership.ts` uses a Postgres transaction advisory lock; `sweeper.ts` evicts sessions, expires leases, and prunes retained events.                                                                     |
| Optional edge tier               | **Implemented** | Compose overlays Traefik and a restricted Docker socket proxy; `scripts/acp-docker-edge-smoke.mjs` tests SQLite and two-replica HA discovery and routing.                                                                       |
| Release/production operations    | **Partial**     | The repository builds one non-root Docker image and declares npm bins. Registry publication, versioned migration orchestration, managed hosting, production certificates, and an explicit connection-drain policy are deferred. |

## Context

The reference host runs as a single long-lived Node process:
`src/app/server/main.ts` launches `HttpAppLive` via `NodeRuntime.runMain` +
`Layer.launch` on `NodeHttpServerLive`. `HttpAppLive` merges the HTTP/RPC router
with `SweeperLive` — a never-terminating background eviction daemon — over a
single shared `AppLive`, so routes and the sweeper share one configured runtime.
Durable state and live fan-out may now live in Postgres; memory, SQLite, and the
in-process broker remain process-local choices.

Two questions forced this decision:

1. **"Can we deploy ACP to Vercel?"** A 2026-07-02 architecture review found the
   host is fundamentally incompatible with stateless serverless functions, for
   three reasons that the [[Storage]] seam does **not** cover:
   - **Fan-out was in-process.** At decision time, [[event-store]] owned one
     process-local `PubSub`; separate invocations could not share live events.
     The implemented [[event-broker]] seam now adds Postgres `LISTEN/NOTIFY` for
     persistent multi-replica hosts, but does not make ephemeral function
     invocations a supported runtime.
   - **Connections are long-lived.** SSE holds an open streaming response
     indefinitely; the `GET /rpc` socket "lives exactly as long as the socket."
     Ephemeral, timeout-bound function invocations do not own that lifecycle.
   - **The sweeper is a daemon.** `SweeperLive` is an `Effect.forever` loop; there
     is no serverless process to host it, and lease expiry _emits_
     `lease.expired` events (`lease-service.ts`). Postgres advisory-lock
     leadership now makes one replica execute each sweep, but a persistent
     process is still required.

2. **"Deploy the server, but let developers use their own database."** A single
   running process connects to exactly one database, so "bring your own DB" is not
   a property of one hosted server — it is a _deployment topology_. There are two
   distinct shapes, and the product needs both:
   - **Central hosted (multi-tenant):** we run the host and own one database;
     developers receive a token scoped to a `workspace_id` and configure no
     database. ACP already models the tenant boundary — `workspaceId` is the key
     on every entity and every event.
   - **Self-hosted (single-tenant):** each developer/org runs their own host and
     sets their own `DATABASE_URL`; the database is per-deployment.

At decision time, [[Storage]] was already a clean `Context.Tag` with InMemory and
SQLite adapters. The implementation retained that boundary and added Postgres,
an [[event-broker]] seam, and workspace-scoped bearer sessions without making
routes or transports own persistence. External identity resolution remains a
deployment integration rather than a completed runtime adapter.

## Decision

Ship **one server binary that serves every deployment topology by configuration**,
never a per-deployment code fork. Generalize the existing config-selected-adapter
pattern from one seam to **three**, and expose **named profiles** as presets over
them.

### Three config-selected seams

1. **Storage — implemented.** `memory | sqlite | postgres` are selected in
   [[storage-live]]. The Postgres `StorageApi` layer uses **`@effect/sql-pg`**
   for scoped connections and atomic per-workspace event/memory sequences. It
   initializes the current schema on layer construction; a versioned migration
   runner remains deferred.

2. **EventBroker — partial.** [[event-store]] publishes through an
   `EventBroker` `Context.Tag` with two implemented adapters:
   - `in-process` — process-local `PubSub` for one node.
   - `pg-notify` — Postgres `LISTEN/NOTIFY` fan-out for multi-replica HA with no
     second stateful dependency.
   - `redis` — **deferred**; no config value, dependency, or adapter ships.
     The [[EventStream]] SSE/WebSocket adapters render whichever implemented
     broker yields events and remain transport concerns.

3. **Identity/Auth — partial.** `ACP_REQUIRE_AUTH` enforces bearer session IDs
   and permission scopes. Sessions may carry `workspace_ids`, and
   `ACP_REQUIRE_WORKSPACE_BINDINGS` requires a non-empty binding and enforces it
   across HTTP and native RPC. The runtime does not issue external developer
   tokens or integrate OIDC; an identity provider must initialize the scoped ACP
   session through a trusted boundary.

### Deployment profiles (presets over the seams)

`ACP_PROFILE` selects a preset; individual `ACP_*` vars still override.

The executable presets in `src/config/app-config.ts` are canonical. Explicit
`ACP_*` variables override any preset.

| Profile        | Storage  | EventBroker | Bearer auth | Workspace binding | Shipped reference                                                                                                                          |
| -------------- | -------- | ----------- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `local`        | memory   | in-process  | off         | optional          | Direct Node/CLI default. Compose's `sqlite` profile starts here and overrides storage to SQLite.                                           |
| `single-node`  | sqlite   | in-process  | required    | optional          | One-process self-host preset; no dedicated Compose service because the `sqlite` service is the auth-off daily driver.                      |
| `hosted`       | postgres | pg-notify   | required    | required          | Runtime preset only; managed hosting, external identity, and LB manifests are not shipped.                                                 |
| `self-host-ha` | postgres | pg-notify   | required    | required          | Compose `ha` uses this preset but explicitly disables auth/bindings for local dogfood; operators must enable both for a shared deployment. |

### Serverless is out of scope for the runtime

Vercel/Lambda-style serverless functions are **not** a supported host for the ACP
runtime. They may front a `hosted` deployment as domain, edge routing, docs, and
static auth UI, proxying to the persistent host. This is recorded so the question
is settled and not re-litigated per session.

### Edge tier (optional)

A reverse proxy is an optional edge tier in front of any profile, not a fourth
config-selected seam — it terminates TLS and load-balances but holds no ACP
state. Traefik (free OSS) is the reference implementation, wired as an opt-in
`edge` Compose profile that overlays either the `single-node` or
`self-host-ha` base:

- **Ownership split.** Traefik owns `:80`/`:443` (public ingress) and `:8080`
  (its loopback-only dashboard); `acp` keeps publishing `4317`, while the first
  `acp-ha` replica receives `4317` and scaled replicas receive the next available
  port through `4326`. The `./bin/acp` wrapper therefore retains its direct
  `4317` entry point while Traefik uses each replica's internal `4317` endpoint.
- **TLS.** Self-signed by default (no ACME/Let's Encrypt dependency, no public
  DNS requirement) — appropriate for clone-and-go and internal deployments;
  operators front it with a real certificate at their own domain when needed.
- **Load balancing.** Traefik's Docker provider discovers `acp-ha` replicas via
  labels and load-balances across them, so
  `docker compose --profile ha --profile edge up --scale acp-ha=3` scales the
  reference `self-host-ha` topology behind one address with no router config
  change. The repository does not ship a managed `hosted` deployment.
- **Docker discovery boundary.** Traefik does not mount the daemon socket. A
  pinned Tecnativa socket proxy owns the read-only mount and exposes only
  version, ping, event, container, and network reads over a private internal
  network shared with Traefik; mutation methods and unrelated API sections are
  denied. This narrows, but does not eliminate, the host-level trust boundary.
  A stricter production edge also drops the `4317` host publish once proxy-only
  ingress is desired and disables or authenticates the dashboard. The default
  dev/self-host posture retains direct `bin/acp` access alongside the proxy.
  Exact Traefik/socket-proxy release tags and their narrow Dependabot update
  policy are documented in the README.

### Operational contract

- **Implemented — sweeper under replication.** `SweeperLeadershipLive` keeps an
  in-process single writer for memory/SQLite and uses
  `pg_try_advisory_xact_lock` for Postgres. One replica performs session
  eviction, lease expiry, and retention per tick without an external cron.
- **Implemented — event retention.** `ACP_EVENT_RETENTION_DAYS` defaults to 30;
  `sweepOnce` calls `EventStore.pruneBefore`, while values at or below zero
  disable pruning. Storage adapters preserve each workspace's newest event so
  sequence high-water marks do not reset.
- **Partial — migrations.** SQLite and Postgres initialize/extend their schemas
  idempotently at adapter startup. There is no versioned migration ledger or
  separate hosted deploy step yet; operators must not infer zero-downtime schema
  orchestration from the startup DDL.
- **Implemented — connection scoping.** `@effect/sql-pg` owns scoped Postgres
  clients for storage, broker, and sweeper leadership. A serverless pooler is
  irrelevant to the supported persistent runtime and remains an operator concern
  for any external architecture.
- **Implemented — delivery semantics.** Live SSE/WebSocket delivery is
  best-effort; durable `GET /v1/events` replay by `seq` is the reconnect path.
  `pg-notify` carries an event pointer and reads the durable event back; it does
  not promise queue semantics.
- **Partial — health and lifecycle.** Unauthenticated `/health` and
  storage-backed `/ready` probes ship and the Docker image declares `/ready` as
  its health check. Runtime resources are scoped by Effect/NodeRuntime, but an
  explicit SSE/WebSocket drain deadline and shutdown regression are deferred.
- **Partial — packaging.** One multi-stage, non-root Docker build runs every
  profile and `package.json` declares the `acp`/`acp-jsonrpc-stdio` bins. Registry
  publication and release automation are not claimed by this ADR.

## Rationale

The [[Storage]] seam already proves the pattern: adapters swap under a stable
`Context.Tag` with zero domain churn. Extending it to the broker and auth keeps
the domain services untouched while unlocking horizontal scale and self-serve
hosting from a **single** artifact — the same property that lets infrastructure
tools (Temporal, Grafana) deploy everywhere from one binary. Choosing Postgres
`LISTEN/NOTIFY` for the default HA broker means the entire `hosted` topology needs
only **Postgres** — no Redis, no external queue, no cron — which is the smallest
production surface that still scales past one replica. `@effect/sql-pg` keeps the
storage adapter inside the Effect runtime the rest of the system already lives in
(consistent error channels, resource scoping, pooling) rather than bolting on a
raw driver.

## Consequences

The [[event-broker]] extraction and Postgres adapter are now behind stable
`Context.Tag` surfaces; `@effect/sql` and `@effect/sql-pg` remain pre-1.0
dependencies whose churn should stay inside adapters. Memory and SQLite are
single-process deployment choices; Postgres allocates event and memory sequence
numbers atomically for replication. Serverless remains closed as a runtime
target. `local` still defaults to memory + in-process + no auth, while the
reference SQLite Compose service explicitly overrides only the storage adapter.

## Alternatives

**Rebuild the host to run on Vercel serverless functions** — rejected: requires an
external broker, an external cron sweeper, and dropping in-process streaming, i.e.
rebuilding the three hardest subsystems to fight the platform, for a worse product
on an inherently stateful, stream-oriented protocol.

**Fork the codebase per deployment (a "cloud" build and a "self-host" build)** —
rejected: doubles maintenance and drifts; the seam pattern already makes one
binary sufficient.

**Use a raw `pg`/`postgres.js` driver instead of `@effect/sql-pg`** — rejected for
the primary path: it re-introduces non-Effect resource/error handling the codebase
deliberately avoids. Retained as a fallback only if `@effect/sql-pg` churn blocks.

**Redis as the default HA broker** — rejected as default: it adds a second stateful
dependency to every multi-replica deployment for no benefit over `LISTEN/NOTIFY`
at ACP's fan-out scale. Kept as an optional adapter.

## Validation

Current implementation evidence:

- profile presets and override behavior: `src/config/app-config.ts` and
  `app-config.test.ts`;
- storage/broker selection: `src/app/{storage-live,event-broker-live}.ts`, with
  adapter tests under `src/infrastructure/{storage,events}`;
- auth and workspace boundaries: `src/app/server/route-support.ts`,
  `src/infrastructure/rpc/rpc-auth.ts`, and their workspace-scope tests;
- retention and single-writer HA sweeps: `src/app/server/sweeper.ts`,
  `src/app/server/sweeper-leadership.ts`, and tests;
- executable topology: `docker-compose.yml`, `Dockerfile`, Traefik config, and
  `scripts/acp-docker-{ha-dogfood,edge-smoke}.mjs`;
- end-to-end regression: the complete Docker self-dogfood CI job exercises
  production image behavior, restart/auth boundaries, Postgres/pg-notify HA,
  and SQLite/two-replica edge routing.

## Referenced by

[[ADR-0001-architecture-foundation]] · [[ADR-0007-effect-rpc-adoption]] ·
[[Storage]] · [[EventStream]] · [[Transport]] · [[event-store]] ·
[[sweeper]] · [[decisions/_MOC]]
