---
type: module
path: '@root/src/infrastructure/http/acp-http-api-resume.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.58
depth_status: MEDIUM
tags: [module, medium]
aliases: [acp-http-api-resume, ResumeGroup]
---

# HTTP Resume API Group

## Purpose

Declare the compact typed HTTP contract for retrieving one [[WorkUnit]] resume
packet without adding more surface to the central API file.

## Interface

```typescript
export const ResumeGroup: HttpApiGroup.HttpApiGroup<'resume', ...>
// GET /v1/work/:work_id/resume
// success WorkResumePacket · errors ProtocolError 401/404
```

## Algorithm

Decode branded `work_id` from the route path, declare `WorkResumePacket` success,
and attach protocol-error schemas for unauthorized and missing work outcomes.

## Negative Logic

- ❌ Do NOT implement handlers or access services in the contract module.
- ❌ Do NOT accept unbranded work ids.
- ❌ Do NOT hand-map error bodies outside `ProtocolError`.

## Depth

MEDIUM (0.58). One group hides path decoding and typed success/error metadata from
the aggregate [[acp-http-api]].

## Grill Log

- **Q:** Why split one endpoint into a file? **A:** The central API is at the
  file-size boundary; the group is a coherent resume capability composed once.

## Referenced by

[[acp-http-api]] · [[http/_MOC]]
