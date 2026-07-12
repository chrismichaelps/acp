---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-lease-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.66
depth_status: MEDIUM
tags: [module, seam, json-rpc]
aliases: [json-rpc-lease-commands]
---

# JSON-RPC Lease Commands

## Purpose

Own lease readback and lifecycle JSON-RPC method mappings so
[[json-rpc-command-map]] remains under the file-size gate while lease
request/list/renew/release/revoke behavior stays in one transport projection
module.

## Interface

```typescript
export const leaseMethodLabels: readonly string[]
export const commandForLease: (
  method: JsonRpcMethod,
  paramsValue: Option<unknown>,
  id: Option<JsonRpcId>,
  expectsResponse: boolean,
) => Option<Either<JsonRpcCommand, JsonRpcRequestError>>
```

### Methods

- `lease.request`
- `lease.list`
- `lease.renew`
- `lease.release`
- `lease.revoke`

## Algorithm

`lease.request` validates params through [[lease.schema]] `RequestLeasePayload`
and maps to `POST /v1/leases`. `lease.list` decodes `workspace_id` and maps to
the workspace-scoped `GET /v1/leases?workspace_id=...` route for current and
terminal lease readback. `lease.renew` decodes `lease_id` plus optional positive
`ttl_seconds`, then maps to `POST /v1/leases/{lease_id}/renew`. `lease.release`
and `lease.revoke` decode `lease_id` and map to their terminal state routes. All
path ids and query identifiers are URL-encoded through
[[json-rpc-command-support]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate [[lease-service]] lifecycle rules here.
- ❌ Do NOT execute HTTP or domain services here.
- ❌ Do NOT hand-build unencoded lease ids.

## Depth

MEDIUM (0.66). It is a mapping table, but it keeps the lease readback and
lifecycle JSON-RPC projection coherent while preserving command-map capacity.

## Referenced by

[[json-rpc-command-map]] · [[json-rpc-lease-commands.test]] · [[jsonrpc/_MOC]]
