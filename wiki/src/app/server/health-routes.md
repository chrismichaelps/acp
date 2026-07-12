---
type: module
path: '@root/src/app/server/health-routes.ts'
fidelity: Active
domain: '[[Host]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.67
depth_status: DEEP
tags: [module, deep]
aliases: [health-routes, livenessProbe, readinessProbe]
---

# Health Routes

## Purpose

Expose unauthenticated [[Host]] liveness and storage-backed readiness responses
for schedulers and load balancers.

## Interface

```typescript
export const livenessProbe: Effect<HttpServerResponse>
export const readinessProbe: Effect<HttpServerResponse, never, Storage>
```

## Algorithm

`/health` returns 200 with host name and protocol version without dependency I/O.
`/ready` performs one cheap sentinel `Storage.get`; any successful read (including
absence) returns 200, while typed storage failure returns 503.

## Negative Logic

- ❌ Do NOT authorize either probe or require an initialized session.
- ❌ Do NOT let liveness depend on storage availability.
- ❌ Do NOT route traffic to a replica whose readiness storage read fails.

## Depth

DEEP (0.67). Two stable responses hide protocol metadata, dependency distinction,
typed storage folding, and scheduler semantics.

## Grill Log

- **Q:** Why is `/health` always 200 while serving? **A:** It distinguishes process
  failure from dependency failure; `/ready` owns drain decisions.
- **Q:** Why read a nonexistent sentinel key? **A:** Success proves the storage
  read path without mutating state or depending on tenant data.

## Referenced by

[[health-routes.test]] · [[acp-router]] · [[Host]] · [[server/_MOC]]
