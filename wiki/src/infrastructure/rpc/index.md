---
type: module
path: '@root/src/infrastructure/rpc/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.4
depth_status: MEDIUM
tags: [module, medium, rpc]
aliases: [rpc-index]
---

# Effect RPC Index

## Purpose

Opaque barrel for the native Effect RPC infrastructure package. It exports the
current [[acp-rpc-contract]], handler layer, auth helper, and error
mapper without exposing callers to file layout decisions.

## Interface

```typescript
export * from './acp-rpc-contract.js'
export * from './acp-rpc-handlers.js'
export * from './rpc-auth.js'
export * from './rpc-error.js'
```

## Algorithm

No runtime behavior. The module preserves the export law for
`src/infrastructure/rpc/`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add handler logic or transport wiring here.
- ❌ Do NOT re-export JSON-RPC modules from the native RPC package.

## Depth

MEDIUM (0.4). A shallow but useful package boundary; it becomes more valuable as
handlers, middleware, and clients join the folder.

## Referenced by

[[rpc/_MOC]] · [[src/_MOC]]
