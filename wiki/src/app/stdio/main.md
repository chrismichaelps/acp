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

### Executable ADR-0013 acceptance proof

The hardened Docker auth probe starts the production bridge inside the running
auth container with:

```text
docker exec -i <auth-container> node dist/app/stdio/main.js
```

It constructs the JSON-RPC request below as UTF-8 bytes, prefixes the exact byte
count as `Content-Length: <n>\r\n\r\n`, writes the frame to stdin, then closes
stdin so the bridge exits after forwarding the response:

```json
{
  "jsonrpc": "2.0",
  "id": "stdio-review-collaborator",
  "method": "session.initialize",
  "params": {
    "worker": {
      "id": "agent_stdio_reviewer_<run>",
      "name": "Stdio reviewer",
      "kind": "agent"
    },
    "permissions": ["review:collaborate"],
    "workspace_ids": ["<allowed-workspace>"]
  }
}
```

The probe decodes stdout with `decodeStdioFrames` and requires exactly one
complete response frame, no trailing bytes, the same JSON-RPC id, a successful
result whose `permissions` is exactly `["review:collaborate"]`, whose
`workspace_ids` is exactly the allowed workspace, and whose `session_id` matches
the secure session-id shape. It then passes that id to the container CLI (REST)
for one allowed reviewer collaboration mutation and requires workspace create,
update, and archive to return `403 forbidden`. A second framed initialization
with `review:respond` proves that the shared codec preserves the worker-only
literal; the route suites own the answer/adjudication denials. A third framed
initialization containing both scopes must return the JSON-RPC invalid-request
mapping with `review:respond and review:collaborate are mutually exclusive`, no
`result.session_id`, and no usable bearer credential.

This is subprocess evidence for the actual bridge, not an inference from
`POST /rpc` or the pure [[stdio-frames.test]] codec suite.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT execute domain services directly from the stdio process.
- ❌ Do NOT parse and reserialize JSON bodies before forwarding; `/rpc` owns JSON-RPC semantics.
- ❌ Do NOT emit a frame for HTTP `204` notification responses.
- ❌ Do NOT call stdio permission propagation proven without spawning the
  production bridge and decoding its returned Content-Length frame.
- ❌ Do NOT invent comment/grill JSON-RPC methods; follow-on action proof uses
  the REST-owned surface with the stdio-minted bearer session.
- ❌ Do NOT call the role boundary proven without rejecting a dual-scope framed
  initialization.

## Depth

MEDIUM (0.64). The process shell is intentionally narrow; correctness depends on
the pure frame codec and the already-tested `/rpc` runtime.

## Referenced by

[[stdio/_MOC]] · [[rpc-endpoint]] · [[Transport]] · [[src/_MOC]] ·
[[ADR-0013-review-collaboration-permission]] ·
[[2026-07-13-review-collaboration-security-design]] · [[CHANGELOG]]
