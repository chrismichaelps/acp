---
type: module
path: '@root/src/infrastructure/jsonrpc/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, seam]
aliases: [jsonrpc-index]
---

# JSON-RPC Barrel

## Purpose

Opaque public entry point for JSON-RPC transport infrastructure. Callers import
the command mapper and response helpers from here rather than deep-importing the
implementation file.

## Interface

### Signatures

```typescript
export * from './json-rpc.js'
```

### Linkage

- **Requires:** [[json-rpc]]
- **Consumed by:** future stdio/WebSocket JSON-RPC host adapters.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT put stdio, WebSocket, or router execution logic in the barrel.

## Depth

MEDIUM (0.5). Aggregates the JSON-RPC infrastructure surface.

## Referenced by

[[jsonrpc/_MOC]] · [[Transport]] · [[src/_MOC]]
