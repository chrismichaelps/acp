---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-event-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.64
depth_status: MEDIUM
tags: [module, seam, json-rpc]
aliases: [json-rpc-event-commands]
---

# JSON-RPC Event Commands

## Purpose

Own JSON-RPC mappings for [[Event]] replay and live subscription commands so
[[json-rpc-command-map]] does not grow past the file-size gate. The module maps
replay reads to JSON `GET /v1/events` and keeps `events.subscribe` mapped to the
existing live stream route used by SSE and WebSocket subscription handling.

## Interface

```typescript
export const eventMethodLabels: readonly ['events.list', 'events.subscribe']
export const commandForEvent: (
  method: JsonRpcMethod,
  paramsValue: Option<unknown>,
  id: Option<JsonRpcId>,
  expectsResponse: boolean,
) => Option<Either<JsonRpcCommand, JsonRpcRequestError>>
```

### Methods

- `events.list`
- `events.subscribe`

## Algorithm

`events.list` decodes `workspace_id` plus optional non-negative integer
`after_seq`, then maps to `GET /v1/events?workspace_id=...&after_seq=...`.
`events.subscribe` decodes `workspace_id`, maps to
`GET /v1/events/stream?workspace_id=...`, and marks the command as `stream: true`
so HTTP JSON-RPC continues rejecting it while [[rpc-socket]] can special-case the
live subscription.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT dispatch HTTP or domain services here.
- ❌ Do NOT duplicate [[event-store]] replay logic.
- ❌ Do NOT map worker presence events; this module is only persisted workspace
  [[Event]] history.

## Depth

MEDIUM (0.64). The module is a small method table but keeps event replay/live
mapping cohesive and preserves the central command map's file-size capacity.

## Referenced by

[[json-rpc-command-map]] · [[jsonrpc/_MOC]]
