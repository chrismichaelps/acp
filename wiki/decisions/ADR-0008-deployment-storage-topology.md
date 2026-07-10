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
Implementation is staged and NOT yet started; this ADR records the direction so
parallel work sequences against it.

## Context

The reference host runs as a single long-lived Node process:
`src/app/server/main.ts` launches `HttpAppLive` via `NodeRuntime.runMain` +
`Layer.launch` on `NodeHttpServerLive`. `HttpAppLive` merges the HTTP/RPC router
with `SweeperLive` — a never-terminating background eviction daemon — over a
single shared `AppLive`, so **routes, sweeper, and all state live in one process**.

Two questions forced this decision:

1. **"Can we deploy ACP to Vercel?"** A 2026-07-02 architecture review found the
   host is fundamentally incompatible with stateless serverless functions, for
   three reasons that the [[Storage]] seam does **not** cover:
   - **Fan-out is in-process.** [[event-store]] holds a single
     `PubSub.unbounded<Event>` (`src/domain/events/event-store.ts`). Every SSE
     stream (`GET /v1/events/stream`) and every WebSocket subscription
     ([[rpc-socket]]) reads from it. A subscriber only receives events published
     **by the same process** — two serverless invocations each get an empty
     PubSub.
   - **Connections are long-lived.** SSE holds an open streaming response
     indefinitely; the `GET /rpc` socket "lives exactly as long as the socket."
     Serverless functions cold-start per request and die on timeout (10s default,
     300s max on Vercel).
   - **The sweeper is a daemon.** `SweeperLive` is an `Effect.forever` loop; there
     is no serverless process to host it, and lease expiry _emits_ `lease.expired`
     events (`lease-service.ts`), so it cannot be replaced by passive DB TTL.

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

The seam foundation is already strong. [[Storage]] is a clean `Context.Tag` with
two adapters (`InMemory`, `SQLite`) selected by `ACP_STORAGE_ADAPTER` in
`src/app/storage-live.ts`; all durable domain state flows through its 35 call
sites inside the ten domain services — no route or transport code touches storage
directly. What is missing for horizontal/self-serve deployment is a **network**
storage adapter, a **cross-process** event fan-out, and a **multi-tenant auth**
resolver — none of which require domain changes.

## Decision

Ship **one server binary that serves every deployment topology by configuration**,
never a per-deployment code fork. Generalize the existing config-selected-adapter
pattern from one seam to **three**, and expose **named profiles** as presets over
them.

### Three config-selected seams

1. **Storage** _(exists; add one adapter)._ `memory | sqlite | postgres`. Add a
   `postgres` `StorageApi` `Layer` mirroring [[sqlite-store]], plus one branch in
   [[storage-live]]. Driver: **`@effect/sql-pg`** (Effect-native connection
   pooling + migrations; coherent with the all-Effect stack — no raw `pg`). The
   monotonic per-workspace `seq` — today assigned by counting rows
   (`in-memory-store.ts`), which races across processes — becomes a Postgres
   `BIGSERIAL`/sequence so ordering is atomic under concurrent writers.

2. **EventBroker** _(new seam; the core new work)._ Extract the in-process
   `PubSub` from [[event-store]] behind an `EventBroker` `Context.Tag` with three
   adapters:
   - `in-process` — the current `PubSub` (single node; behaviour-preserving).
   - `pg-notify` — Postgres `LISTEN/NOTIFY` fan-out (multi-replica HA with **no
     second dependency** beyond the Postgres already used for storage).
   - `redis` — Redis pub/sub (optional; for deployments that already run Redis or
     need higher fan-out throughput).
     The [[EventStream]] SSE/WebSocket adapters render whatever the broker yields and
     are unchanged. This is what makes SSE/WebSocket correct across replicas.

3. **Identity/Auth** _(exists as a flag; make it real)._ `ACP_REQUIRE_AUTH`
   already gates auth. Add a token→workspace resolver so a developer's token
   scopes them to their workspace(s) for the hosted topology; self-hosted uses a
   static token or leaves auth off.

### Deployment profiles (presets over the seams)

`ACP_PROFILE` selects a preset; individual `ACP_*` vars still override.

| Profile        | Storage           | EventBroker     | Auth            | Target          | Audience              |
| -------------- | ----------------- | --------------- | --------------- | --------------- | --------------------- |
| `local`        | memory            | in-process      | off             | `npx acp`       | dev laptop / CI       |
| `single-node`  | postgres (sqlite) | in-process      | static token    | 1 container     | small team, self-host |
| `hosted`       | postgres          | pg-notify       | token→workspace | N replicas + LB | our managed service   |
| `self-host-ha` | postgres          | pg-notify/redis | static / OIDC   | N replicas      | enterprise / on-prem  |

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
  (its dashboard); `acp`/`acp-ha` keep publishing `4317` directly so the
  `./bin/acp` wrapper is unaffected whether or not the edge profile is running.
- **TLS.** Self-signed by default (no ACME/Let's Encrypt dependency, no public
  DNS requirement) — appropriate for clone-and-go and internal deployments;
  operators front it with a real certificate at their own domain when needed.
- **Load balancing.** Traefik's Docker provider discovers `acp-ha` replicas via
  labels and load-balances across them, so
  `docker compose --profile ha --profile edge up --scale acp-ha=3` scales the
  `hosted`/`self-host-ha` topology behind one address with no router config
  change.
- **Production posture.** A stricter production edge drops the `4317`
  host-publish entirely once the proxy is the only intended entry point
  (proxy-only ingress); the default dev/self-host posture keeps `4317`
  published for direct `bin/acp` access alongside the proxy.

### Operational contract (production-ready across profiles)

- **Sweeper under replication.** Keep the in-process daemon for `local`/
  `single-node`. For multi-replica profiles, elect a single sweeper via a Postgres
  **advisory lock** (`pg_try_advisory_lock`) — one replica sweeps, others no-op —
  so lease-expiry events still fire exactly once without an external cron.
- **Event retention.** `ACP_EVENT_RETENTION_DAYS` is currently declared but
  **unenforced** (no consumer); on a durable backend the event log grows
  unbounded. Enforcement moves into the swept work.
- **Migrations.** The `postgres` adapter ships a versioned schema + migration
  runner (`@effect/sql` migrator); `single-node` may migrate on boot, `hosted`
  gates migrations behind a deploy step.
- **Connection pooling.** The `postgres` adapter pools connections. If any
  deployment ever fronts Postgres from a serverless tier, a pooler
  (PgBouncer / Neon proxy) is required to avoid connection storms.
- **Delivery semantics.** Live SSE/WebSocket is best-effort; durable catch-up is
  the `GET /v1/events` replay by `seq`. Clients reconcile via replay after
  reconnect (already supported). The broker does not add delivery guarantees.
- **Health & lifecycle.** `hosted`/`self-host-ha` expose liveness/readiness and
  drain SSE/WebSocket on graceful shutdown.
- **Packaging.** Publish a Docker image + npm bin; the same image runs every
  profile via env.

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

The `EventBroker` extraction touches the central [[event-store]] and must be
sequenced against parallel transport work (as [[ADR-0007-effect-rpc-adoption]]
warned for the router). `@effect/sql` and `@effect/sql-pg` become new
dependencies (pre-1.0, may churn — the `StorageApi`/`EventBroker` Tags are the
stable surface; adapters are swappable). The `seq`-by-row-count implementation in
[[in-memory-store]] is retained for `memory`/`sqlite` but explicitly documented as
single-process-only; correctness under replication is a property of the `postgres`
adapter's sequence. Serverless is closed as a runtime target. Nothing changes for
`local` developers: `memory` + `in-process` + no auth remains the default, so the
existing test and dogfood tiers are unaffected.

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

Direction only; no code yet. Evidence: the 2026-07-02 architecture map of
`src/app/server/main.ts`, `src/domain/events/event-store.ts`,
`src/infrastructure/storage/*`, `src/infrastructure/sse/*`, and
`src/app/server/{rpc-socket,sweeper}.ts`, plus the confirmed absence of any
SQL/Redis dependency in `package.json` (all-Effect stack).

## Referenced by

[[ADR-0001-architecture-foundation]] · [[ADR-0007-effect-rpc-adoption]] ·
[[Storage]] · [[EventStream]] · [[Transport]] · [[event-store]] ·
[[sweeper]] · [[decisions/_MOC]]
