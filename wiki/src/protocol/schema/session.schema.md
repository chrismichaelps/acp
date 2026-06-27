---
type: module
path: "@root/src/protocol/schema/session.schema.ts"
fidelity: Active
domain: "[[Worker]]"
grammar: "[[grammar/typescript]]"
depth_score: 0.4
depth_status: SHALLOW
tags: [module, shallow]
aliases: [session.schema]
---

# Session Schema

## Purpose
Wire + domain shape of a Session — the record minted at
`POST /v1/session/initialize` (spec §9) that binds a `SessionId` to the
[[Worker]] that opened it. The `id` doubles as the v0.1 bearer token (spec §8).

## Interface
### Signatures
```typescript
export const Session: Schema.Struct<{
  id: SessionId; worker_id: WorkerId; created_at: Timestamp
}>
export type Session = typeof Session.Type
```

## Algorithm
Struct over [[ids]] (`SessionId`, `WorkerId`) + [[common]] (`Timestamp`).
Persisted by [[session-service]] via the `session` collection.

## Negative Logic (Prohibited Paths)
- ❌ Do NOT add scopes/expiry here — v0.1 sessions carry no policy (see
  [[session-service#Grill Log]]).

## Depth
SHALLOW (0.4). A pure data shape; the actor-resolution behavior lives in
[[session-service]].

## Referenced by
[[session-service]] · [[schema/index]] · [[src/_MOC]]
