---
type: module
path: '@root/src/infrastructure/http/acp-http-api-memory.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, seam, memory, http-api]
aliases: [acp-http-api-memory]
---

# Memory HTTP API Contract

## Purpose

The declarative `HttpApiGroup` for workspace [[Memory]], split out of the
near-limit [[acp-http-api]] so the contract for `POST /v1/memory` and
`GET /v1/memory` plus the shared `MemoryListParams` query schema lives in one
file. Added to `AcpHttpApi` as the `memory` group.

## Interface

```typescript
export const MemoryListParams // search-params schema for GET /v1/memory
export const MemoryGroup // HttpApiGroup 'memory'
```

### Endpoints

- `createMemory` — `POST /v1/memory`, payload `CreateMemoryPayload`, success
  `Memory` (`201`), errors `400`/`401`.
- `listMemory` — `GET /v1/memory`, url-params `MemoryListParams`, success
  `Memory[]` (`200`), errors `400`/`401`.

## Algorithm

`MemoryListParams` decodes URL strings into the [[memory.schema]] `ReadMemoryQuery`
shape: `workspace_id` required, `after_seq` `NumberFromString` defaulting to `0`,
and optional `limit`/`work_id`/`kind`/`key`/`label` as `Option`. Every field
**encodes back to a string** (no `nullable`), satisfying the platform's UrlParams
"encodeable to strings" constraint.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use `{ nullable: true }` on a UrlParams field — its Encoded type then
  includes `null` and fails the string-encodeable constraint.
- ❌ Do NOT re-declare `CreateMemoryPayload`/`Memory` — import from
  [[memory.schema]].

## Depth

MEDIUM (0.6). A contract declaration, but the UrlParams encodeability rule is a
real constraint this module exists to satisfy.

## Grill Log

- **Q:** Why drop `nullable: true` from the optional query fields?
  **A:** A query string can only carry strings or absence, never JSON `null`.
  `nullable` widened the Encoded type to include `null`, which the platform
  rejects for UrlParams. `{ as: 'Option' }` alone decodes absent → `None` and
  keeps Encoded `string | undefined`. _Rejected:_ keeping `nullable` (the WIP
  state — a hard `tsc` failure).

## Referenced by

[[acp-http-api]] · [[memory-routes]] · [[memory.schema]] · [[http/_MOC]]
