---
type: module
path: '@root/src/protocol/schema/resume.schema.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Protocol]]'
depth_score: 0.45
depth_status: SHALLOW
tags: [module, schema, shallow]
aliases: [resume-schema, work-resume-packet]
---

# Resume Schema

## Purpose

Defines the compact work resume packet used by [[resume-routes]]. The packet is
the token-efficient handoff shape for an agent returning to a known work unit:
one response carries the current [[WorkUnit]], latest [[Checkpoint]], artifact
metadata, review state, the unresolved [[ReviewComment]] backlog
(`open_comments`), and the newest [[Grill]] across the work's reviews
(`latest_grill`) so a resuming reviewer sees the open review-gate obligations.

## Interface

```typescript
export const WorkResumePacket: Schema
```

## Algorithm

The schema composes existing protocol objects. `latest_checkpoint` is optional
because a work unit may exist before any checkpoint has been written. Artifacts
remain metadata-only; callers use `artifact content` when they intentionally
need stored artifact content. `open_comments` is the `open`-state slice of the
work's [[ReviewComment]] backlog, and `latest_grill` is optional because most
work units never open a [[Grill]]; when present it is the newest grill by
`created_at` across the work's reviews. Both are additive — existing consumers
ignore the extra fields.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT embed artifact content in the resume packet.
- ❌ Do NOT duplicate event history; agents can replay [[Event]] separately by
  cursor when they need the full timeline.

## Depth

SHALLOW (0.45). A composition schema that keeps resume packet typing shared
between HTTP contract, router encoding, and tests.
