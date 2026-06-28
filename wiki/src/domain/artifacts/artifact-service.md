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
content collection, updates mutable artifact metadata/content, enforces
[[app-config]] `maxArtifactSizeBytes`, and emits `artifact.*` [[Event]] records
through [[EventStore]].

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
  readonly update: (
    artifactId: ArtifactId,
    payload: UpdateArtifactPayload,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<Artifact, ValidationError | NotFoundError | StorageError>
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
- Creates require useful evidence: either inline `content` for host storage or an
  explicit external `uri`. When `uri` is omitted, the service mints
  `acp://artifacts/{id}` and stores the inline content privately.
- Content is optional when `uri` points to an external artifact. Metadata-only
  creates without content or URI are rejected.
- Content is never copied into event data; events carry id, kind, and URI only.
- `update` preserves `id`, `workspace_id`, `work_id`, `created_by`, and
  `created_at`; it replaces `kind`, `media_type`, `summary`, URI, and optional
  private content, then emits `artifact.updated`. Supplying a `uri` makes the
  artifact an external reference and clears any private content. Supplying
  `content` without a `uri` stores host content and restores
  `acp://artifacts/{id}` as the artifact URI.
- `remove` deletes metadata and private content, then emits `artifact.deleted`.

## Algorithm

1. `create` validates that content or URI is present, validates optional content
   size, builds the Artifact metadata record, stores metadata, stores content when
   present and no external URI was supplied, emits `artifact.created`, and returns
   metadata.
2. `get` loads one Artifact; absence is `Option.none`.
3. `readContent` loads optional private content and fails `StorageError` if the
   stored value is not a string.
4. `listForWork` and `listForWorkspace` decode the artifact collection and filter
   by work or workspace.
5. `update` requires an existing Artifact, validates optional replacement content
   size, saves the metadata replacement with stable identity fields, switches
   between external URI and host content according to the payload, emits
   `artifact.updated`, and returns the updated metadata.
6. `remove` requires an existing Artifact, removes metadata and content, emits
   `artifact.deleted`, and returns the removed metadata.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT accept content larger than `AppConfig.maxArtifactSizeBytes`.
- ❌ Do NOT expose artifact content in the event log.
- ❌ Do NOT store private content when an external URI is supplied for the same
  artifact version.
- ❌ Do NOT mutate artifacts outside this service.
- ❌ Do NOT treat update as delete-plus-create; `artifact.updated` preserves the
  artifact id.

## Depth

DEEP (0.74). The service hides metadata/content collection naming, schema
encode/decode, content size policy, event emission, and list filters behind one
domain surface.

## Grill Log

- **Q:** What URI should a created Artifact receive when the payload has no URI?
  **A:** Use `acp://artifacts/{id}` for host-stored artifacts. _Rationale:_ the
  schema requires a URI, and inline content needs a stable read handle. _Rejected:_
  metadata-only creates (empty evidence); deriving a URI from summary/kind.
- **Q:** What if both `uri` and `content` are supplied?
  **A:** Prefer `uri` and do not store private content. _Rationale:_ explicit
  external references are usually produced by another system of record; copying
  content into the local host would create drift and size pressure. _Rejected:_
  dual storage for the same artifact version.
- **Q:** Should artifact content be stored in the event log?
  **A:** No. The event log is audit metadata, not a content store. Events carry
  stable identity and kind while content remains in the private artifact content
  collection.
- **Q:** Does `artifact.updated` create a new version or mutate the existing
  artifact?
  **A:** Mutate the existing artifact metadata/content while preserving id and URI.
  _Rationale:_ v0.1 has no version schema or artifact lineage model; preserving
  identity gives clients a simple correction path without inventing version
  semantics. _Rejected:_ delete-plus-create (loses continuity and contradicts the
  event name); versioned artifacts (larger domain model for a later slice).

## Referenced by

[[artifacts/_MOC]] · [[Artifact]] · [[src/_MOC]]
