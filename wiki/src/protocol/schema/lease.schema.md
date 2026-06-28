---
type: module
path: '@root/src/protocol/schema/lease.schema.ts'
fidelity: Active
domain: '[[Lease]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [lease.schema]
---

# Lease Schema

## Purpose

Wire + domain shape of a [[Lease]] and the `RequestLease` payload (spec §10.4, §12.7).

## Interface

### Signatures

```typescript
export const Lease: Schema.Struct<{
  id: LeaseId
  workspace_id: WorkspaceId
  work_id: optionalWith<WorkId, Option>
  holder: WorkerId
  resource: Resource
  expires_at: Timestamp
  state: LeaseState
}>
export const RequestLeasePayload: Schema.Struct<{
  workspace_id
  work_id?
  holder
  resource
  ttl_seconds: optionalWith<number, Option>
}>
export type Lease = typeof Lease.Type
```

## Algorithm

Struct over [[ids]] + [[common]] `Resource`/`LeaseState`. `ttl_seconds` decodes to
`Option<number>`; absent ⇒ service applies `ACP_DEFAULT_LEASE_TTL` ([[app-config]]).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT treat a lease as permanent — `expires_at` always bounds it.

## Depth

MEDIUM (0.6).

## Referenced by

[[event.schema]] · [[app-config]] · [[src/_MOC]]
