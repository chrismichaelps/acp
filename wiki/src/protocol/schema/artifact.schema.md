---
type: module
path: '@root/src/protocol/schema/artifact.schema.ts'
fidelity: Active
domain: '[[Artifact]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [artifact.schema]
---

# Artifact Schema

## Purpose

Wire + domain shape of an [[Artifact]] and the `CreateArtifact` payload (spec §10.5, §12.9).

## Interface

### Signatures

```typescript
export const Artifact: Schema.Struct<{
  id: ArtifactId
  work_id: WorkId
  workspace_id: WorkspaceId
  created_by: WorkerId
  kind: ArtifactKind
  uri: NonEmptyString
  media_type: optionalWith<string, Option>
  summary: optionalWith<string, Option>
  created_at: Timestamp
}>
export const CreateArtifactPayload: Schema.Struct<{
  workspace_id
  work_id
  kind
  media_type?
  summary?
  content?: optionalWith<string, Option>
}>
export type Artifact = typeof Artifact.Type
```

## Algorithm

Struct over [[ids]] + [[common]] `ArtifactKind`. `content` (inline body) is optional;
host either stores it (`acp://artifacts/{id}`) or keeps the external `uri`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT accept `content` larger than `ACP_MAX_ARTIFACT_SIZE` — reject at the service.

## Depth

MEDIUM (0.55).

## Referenced by

[[event.schema]] · [[src/_MOC]]
