---
type: module
path: '@root/src/infrastructure/platform-node/node-http-server.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.58
depth_status: MEDIUM
tags: [module, seam]
aliases: [node-http-server, NodeHttpServerLive]
---

# Node HTTP Server

## Purpose

Own the Node-specific HTTP socket Layer for the ACP server. The application HTTP
composition remains socket-agnostic in [[http-app]], while this module supplies
the `@effect/platform-node` server implementation from either an explicit port
or the `ACP_PORT` configuration value.

## Interface

### Signatures

```typescript
export const nodeHttpServerLayer: (
  port: number,
) => Layer.Layer<HttpServer.HttpServer>

export const NodeHttpServerLive: Layer.Layer<HttpServer.HttpServer>
```

### Linkage

- **Requires:** `node:http`, `@effect/platform-node` `NodeHttpServer`, Effect
  `Config`/`Layer`.
- **Consumed by:** [[server-main]], `live-boot.test.ts`, and
  `rpc-socket.test.ts`.

## Algorithm

`nodeHttpServerLayer(port)` builds `NodeHttpServer.layer(() => createServer(), {
port })`. `NodeHttpServerLive` reads `ACP_PORT` through Effect Config, defaults
to `4317`, and unwraps the configured Layer for the production entrypoint. Tests
use the same factory with `port: 0`, preserving the real socket coverage while
letting the OS choose an ephemeral port.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT serve [[acp-router]] here; [[http-app]] owns request handling.
- ❌ Do NOT call `NodeRuntime.runMain` here; [[server-main]] owns launch.
- ❌ Do NOT read non-server runtime configuration here.

## Depth

MEDIUM (0.58). Small adapter, but it establishes the spec-required
`platform-node` boundary for the Node HTTP server and removes direct socket
construction from app code.

## Referenced by

[[platform-node-index]] · [[server-main]] · [[http-app]] · [[Transport]]
