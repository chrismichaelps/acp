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

Wire + domain shape of an [[Artifact]] plus create/update payloads (spec §10.5,
§12.9, and the `artifact.updated` event vocabulary).

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
export const UpdateArtifactPayload: Schema.Struct<{
  kind
  media_type?
  summary?
  content?: optionalWith<string, Option>
}>
export type Artifact = typeof Artifact.Type
```

## Algorithm

Struct over [[ids]] + [[common]] `ArtifactKind`. `content` (inline body) is optional;
host stores it under the stable artifact URI (`acp://artifacts/{id}`).
`UpdateArtifactPayload` intentionally omits identity, workspace, work, URI,
creator, and timestamp; an update replaces mutable metadata/content for the
existing artifact while preserving its durable identity.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT accept `content` larger than `ACP_MAX_ARTIFACT_SIZE` — reject at the service.
- ❌ Do NOT let update payloads change `id`, `workspace_id`, `work_id`, `uri`,
  `created_by`, or `created_at`.

## Depth

MEDIUM (0.55).

## Referenced by

[[event.schema]] · [[src/_MOC]]
