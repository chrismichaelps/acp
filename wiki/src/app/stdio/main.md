---
type: module
path: '@root/src/app/stdio/main.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.64
depth_status: MEDIUM
tags: [module, app, stdio, json-rpc]
aliases: [stdio-main]
---

# Stdio Main

## Purpose

Run a JSON-RPC stdio bridge for ACP. The process IO is supplied by
[[node-process-io]]: it reads Content-Length frames from stdin, forwards each JSON
body unchanged to `POST /rpc` on the configured ACP host, and writes any
non-empty JSON-RPC response back as a Content-Length frame.
This gives tools that expect MCP/LSP-style stdio framing a narrow adapter without
creating a second in-process ACP host.

## Interface

### Runtime Configuration

```text
ACP_BASE_URL      optional, defaults to http://localhost:$ACP_PORT
ACP_PORT          optional, defaults to 4317 when ACP_BASE_URL is absent
ACP_RPC_TOKEN     optional bearer session forwarded to POST /rpc
```

### Package Binary

```text
acp-jsonrpc-stdio -> ./dist/app/stdio/main.js
```

### Linkage

- **Requires:** [[stdio-frames]], [[node-process-io]], `POST /rpc` from
  [[rpc-endpoint]].
- **Consumed by:** stdio-capable host integrations.

## Algorithm

Resolve the target base URL from environment configuration. Accumulate bytes from
`nodeStdin()`, decode every complete Content-Length frame, and POST each JSON
body to `${baseUrl}/rpc` as `application/json`. If `ACP_RPC_TOKEN` is set, forward
it as `Authorization: Bearer ...`. A `204` response is silent because the JSON-RPC
payload was a notification or all-notification batch. Any non-empty response body
is written through `nodeStdoutWrite` using [[stdio-frames]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT execute domain services directly from the stdio process.
- ❌ Do NOT parse and reserialize JSON bodies before forwarding; `/rpc` owns JSON-RPC semantics.
- ❌ Do NOT emit a frame for HTTP `204` notification responses.

## Depth

MEDIUM (0.64). The process shell is intentionally narrow; correctness depends on
the pure frame codec and the already-tested `/rpc` runtime.

## Referenced by

[[stdio/_MOC]] · [[rpc-endpoint]] · [[Transport]] · [[src/_MOC]]
