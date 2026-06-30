---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-review-handlers.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.68
depth_status: MEDIUM
tags: [module, medium, rpc, review]
aliases: [acp-rpc-review-handlers]
---

# ACP RPC Review Handlers

## Purpose

Own the native `@effect/rpc` review handler vertical without expanding
[[acp-rpc-handlers]] into a near-limit module. The module keeps review gate
semantics single-sourced in [[review-service]] while exposing direct handlers
for review requests, reviewer outcomes, cancellation, and review list reads.

## Interface

```typescript
export const AcpRpcReviewHandlersLive: Layer<
  | Rpc.Handler<'review.request'>
  | Rpc.Handler<'review.approve'>
  | Rpc.Handler<'review.reject'>
  | Rpc.Handler<'review.request_changes'>
  | Rpc.Handler<'review.cancel'>
  | Rpc.Handler<'review.list_for_work'>
  | Rpc.Handler<'review.list_for_workspace'>,
  never,
  ReviewService | WorkUnitService | IdClock
>
```

## Algorithm

`review.request` authorizes `review:create`, mints an id and timestamp through
[[id-clock]], and delegates to [[review-service]] so WorkUnit transition to
`needs_review` and `review.requested` event emission remain domain-owned.

Outcome handlers authorize their dedicated review scopes, mint timestamps
through [[id-clock]], and delegate to [[review-service]] for requirement
validation, legal state transitions, WorkUnit outcome coupling, and
`review.*` event emission. `review.cancel` remains a withdrawal path that
returns the WorkUnit to `running`, not a rejection alias.

Read handlers authorize `workspace:read`. `review.list_for_work` first proves
the WorkUnit exists through [[work-unit-service]], matching the HTTP resume
route. `review.list_for_workspace` delegates workspace resolution to
[[review-service]] because review records derive workspace scope through their
WorkUnit.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate review state-transition rules in RPC handlers.
- ❌ Do NOT treat cancellation as rejection.
- ❌ Do NOT dispatch through HTTP, JSON-RPC, stdio, or WebSocket adapters.

## Depth

MEDIUM (0.68). The module is a transport layer, but it protects review/WorkUnit
coupling and keeps the native RPC handler surface reviewable.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-index]] · [[rpc/_MOC]]
