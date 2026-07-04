---
type: reference
tags: [reference, deployment, operations]
aliases: [deployment, deploy, docker, hosting]
---

# Deploying the ACP Host

How to run the ACP reference host so developers can use it. The runtime is a
single long-lived Node process (`dist/app/server/main.js`), so it wants a
**persistent container host** — Railway, Fly.io, Render, a VM, or Kubernetes.
Serverless functions (Vercel/Lambda) are **not** a supported runtime target; see
[[ADR-0008-deployment-storage-topology]] for why (in-process fan-out, long-lived
SSE/WebSocket, the sweeper daemon).

## Container image

The repository ships a multi-stage [`Dockerfile`](@root/Dockerfile) that compiles
`src/ → dist/` and produces a non-root runtime image. Its `HEALTHCHECK` targets
the `GET /ready` probe, so an orchestrator only routes traffic once storage
answers.

```bash
docker build -t acp .
docker run -p 4317:4317 -e ACP_PORT=4317 acp
# liveness:  curl localhost:4317/health   -> {"status":"ok",...}
# readiness: curl localhost:4317/ready    -> {"status":"ready"}
```

The same image runs every profile — only environment differs.

## Platform notes

| Platform   | How                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Railway    | Deploy from repo (Nixpacks) or the `Dockerfile`; add a Postgres plugin and set `DATABASE_URL`. Point the health check at `/ready`. |
| Fly.io     | `fly launch` detects the `Dockerfile`; set `[http_service.checks]` path to `/ready`; `fly postgres create` for durable state.      |
| Render     | Web Service from the `Dockerfile`; Health Check Path `/ready`.                                                                     |
| Kubernetes | `livenessProbe` → `/health`, `readinessProbe` → `/ready`.                                                                          |

## Configuration

All configuration is environment variables (see `.env.example` and
[[ADR-0008-deployment-storage-topology]] for the profile matrix). The
deployment-shaping ones:

| Variable              | Default      | Notes                                                                              |
| --------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `ACP_PORT`            | `4317`       | Bind port; the image `EXPOSE`s it.                                                 |
| `ACP_STORAGE_ADAPTER` | `memory`     | `memory` (ephemeral) · `sqlite` (needs a volume) · `postgres` (network-durable).   |
| `ACP_SQLITE_PATH`     | `acp.sqlite` | With `sqlite`, mount a writable volume and point this at it.                       |
| `ACP_DATABASE_URL`    | unset        | Required for the `postgres` storage adapter and `pg-notify` event broker.          |
| `ACP_EVENT_BROKER`    | `in-process` | `in-process` for one node · `pg-notify` for Postgres-backed multi-replica fan-out. |
| `ACP_REQUIRE_AUTH`    | `false`      | Turn on for any shared/hosted deployment.                                          |
| `ACP_SESSION_TTL`     | `1h`         | Session eviction window (swept in-process).                                        |
| `ACP_SWEEP_INTERVAL`  | `60s`        | Lease/session eviction cadence.                                                    |

### Storage choice by intent

- **`memory`** — demos, CI, ephemeral preview envs. State is lost on restart.
- **`sqlite`** — single-node self-host with durability; requires a persistent
  volume, since a redeploy on most platforms wipes the container filesystem.
- **`postgres`** — the network-durable adapter for multi-replica / managed
  hosting. Pair it with `ACP_EVENT_BROKER=pg-notify` when more than one host
  process serves live SSE/WebSocket subscribers. The sweeper takes a Postgres
  advisory transaction lock before expiring leases or pruning old events, so
  only one replica emits expiry side effects per tick.

## Health checks

- `GET /health` — liveness. `200` while the process serves; no backend calls.
- `GET /ready` — readiness. `200` when storage answers, `503` when it does not.
  **Point the platform health check at `/ready`.**

Both are unauthenticated by design so probes work before any session exists.

## Referenced by

[[ADR-0008-deployment-storage-topology]] · [[Storage]] · [[EventStream]]
