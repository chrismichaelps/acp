---
type: module
path: '@root/src/infrastructure/rpc/rpc-error.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.58
depth_status: MEDIUM
tags: [module, medium, rpc]
aliases: [rpc-error]
---

# RPC Error Mapper

## Purpose

Convert domain errors into the `ProtocolError` envelope used by
[[acp-rpc-contract]]. This gives the first native RPC handlers stable ACP error
codes while the project decides whether later handler slices should expose
domain error classes directly.

## Interface

```typescript
export const toRpcError: (error: DomainError) => ProtocolError
```

## Algorithm

Delegate to the existing [[protocol-error]] `toProtocolError` mapper and return
its body. The mapper preserves `invalid_request`, `unauthorized`, `not_found`,
`lease_conflict`, `invalid_state_transition`, `unsupported_capability`, and
`internal_error` without carrying HTTP status into the RPC error channel.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT expose `StorageError.cause`.
- ❌ Do NOT map native RPC failures to JSON-RPC numeric codes.

## Depth

MEDIUM (0.58). The implementation is deliberately small, but it centralizes the
temporary shared error envelope for the native RPC migration.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-auth]] · [[rpc-index]] · [[rpc/_MOC]]
