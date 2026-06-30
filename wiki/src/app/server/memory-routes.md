---
type: module
path: '@root/src/app/server/memory-routes.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.64
depth_status: MEDIUM
tags: [module, seam, memory]
aliases: [memory-routes]
---

# Memory Routes

## Purpose

The HTTP handlers for workspace [[Memory]] records: `POST /v1/memory` and
`GET /v1/memory`. Split out of the near-limit [[router]] central file, each
handler is the canonical decode → [[memory-service]] → encode transport boundary
(spec §16.8) behind the `memory:create` / `memory:read` scopes.

## Interface

```typescript
export const createMemory: HttpRouter handler // POST /v1/memory
export const listMemory: HttpRouter handler   // GET  /v1/memory
```

## Algorithm

`createMemory` decodes `CreateMemoryPayload` from the JSON body, mints a `memory`
id and `now` from [[id-clock]], authorizes `memory:create`, then calls
`MemoryService.create` and encodes the new [[Memory]] at `201`. `listMemory`
decodes [[acp-http-api-memory]] `MemoryListParams` directly from the search params
— its `Option`-wrapped, `NumberFromString` shape **is** the `ReadMemoryQuery`, so
it feeds `MemoryService.read` without re-decoding — authorizes `memory:read`, and
encodes the `Memory[]` page at `200`. Both handlers pass stable route templates
to [[route-support]] `respond` so memory telemetry does not log workspace ids,
keys, labels, or content.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-decode the params through `ReadMemoryQuery` — `MemoryListParams`
  already yields the query shape; re-decoding the `Option` values fails.
- ❌ Do NOT embed memory write/read rules here — they live in [[memory-service]].
- ❌ Do NOT mint ids or read the clock outside [[id-clock]].

## Depth

MEDIUM (0.64). Thin transport handlers, but they carry the scope gate and the
URL-params-to-domain-query equivalence that keeps the read path single-decode.

## Grill Log

- **Q:** Why does `listMemory` not decode `ReadMemoryQuery` like the JSON-RPC path
  conceptually does?
  **A:** `MemoryListParams` is authored so its decoded `.Type` is structurally the
  `ReadMemoryQuery` (same `Option` fields; `NumberFromString` for the URL strings).
  Passing the decoded value straight to `read` is correct and single-decode;
  re-decoding would feed `Option` objects into a schema expecting raw values and
  fail. _Rejected:_ a second `Schema.decodeUnknown(ReadMemoryQuery)` pass (the
  original WIP — a latent runtime bug).

## Referenced by

[[router]] · [[acp-http-api-memory]] · [[memory-service]] · [[server/_MOC]]
