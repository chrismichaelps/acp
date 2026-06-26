---
type: module
path: '@root/src/domain/artifacts/artifact-service.ts'
fidelity: Active
domain: '[[Artifact]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, deep]
aliases: [artifact-service, ArtifactService]
---

# Artifact Service

## Purpose

Own [[Artifact]] metadata and optional host-stored content for v0.1. An Artifact
is the durable evidence produced by a [[Worker]] under a [[WorkUnit]]. The service
persists metadata through [[Storage]], stores inline payload content in a private
content collection, enforces [[app-config]] `maxArtifactSizeBytes`, and emits
`artifact.*` [[Event]] records through [[EventStore]].

## Interface

```typescript
export interface CreateArtifactInput {
  readonly id: ArtifactId
  readonly payload: CreateArtifactPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export interface ArtifactServiceApi {
  readonly create: (
    input: CreateArtifactInput,
  ) => Effect<Artifact, ValidationError | StorageError>
  readonly get: (
    artifactId: ArtifactId,
  ) => Effect<Option<Artifact>, StorageError>
  readonly readContent: (
    artifactId: ArtifactId,
  ) => Effect<Option<string>, StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect<readonly Artifact[], StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect<readonly Artifact[], StorageError>
  readonly remove: (
    artifactId: ArtifactId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<Artifact, NotFoundError | StorageError>
}

export const ArtifactServiceLive: Layer.Layer<
  ArtifactService,
  never,
  Storage | EventStore | AppConfigTag
>
```

## Governance

- The caller supplies `ArtifactId` and `Timestamp`, matching the existing domain
  service convention until ID and clock seams exist.
- The current create payload has `content` but no external `uri`; therefore this
  slice treats creates as host-stored artifacts with `acp://artifacts/{id}`.
- Content is optional. Metadata-only artifacts are valid and still receive a URI.
- Content is never copied into event data; events carry id, kind, and URI only.
- `remove` deletes metadata and private content, then emits `artifact.deleted`.

## Algorithm

1. `create` validates optional content size, builds the Artifact metadata record,
   stores metadata, stores content when present, emits `artifact.created`, and
   returns metadata.
2. `get` loads one Artifact; absence is `Option.none`.
3. `readContent` loads optional private content and fails `StorageError` if the
   stored value is not a string.
4. `listForWork` and `listForWorkspace` decode the artifact collection and filter
   by work or workspace.
5. `remove` requires an existing Artifact, removes metadata and content, emits
   `artifact.deleted`, and returns the removed metadata.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT accept content larger than `AppConfig.maxArtifactSizeBytes`.
- ❌ Do NOT expose artifact content in the event log.
- ❌ Do NOT invent external URI support until the payload schema carries a URI.
- ❌ Do NOT mutate artifacts outside this service.

## Depth

DEEP (0.74). The service hides metadata/content collection naming, schema
encode/decode, content size policy, event emission, and list filters behind one
domain surface.

## Grill Log

- **Q:** What URI should a created Artifact receive when the payload has no URI?
  **A:** Use `acp://artifacts/{id}` for host-stored artifacts. _Rationale:_ the
  schema requires a URI, and the current payload only supports inline content.
  _Rejected:_ adding an ad-hoc payload URI field outside the schema.
- **Q:** Should artifact content be stored in the event log?
  **A:** No. The event log is audit metadata, not a content store. Events carry
  stable identity and kind while content remains in the private artifact content
  collection.

## Referenced by

[[artifacts/_MOC]] · [[Artifact]] · [[src/_MOC]]
