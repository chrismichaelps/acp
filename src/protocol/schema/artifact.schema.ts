/** @Acp.Protocol.Artifact — wire + domain shape of an Artifact */
import { Schema } from 'effect'
import { ArtifactId, WorkId, WorkspaceId, WorkerId } from './ids.js'
import { ArtifactKind, Timestamp } from './common.js'

export const Artifact = Schema.Struct({
  id: ArtifactId,
  work_id: WorkId,
  workspace_id: WorkspaceId,
  created_by: WorkerId,
  kind: ArtifactKind,
  uri: Schema.NonEmptyString,
  media_type: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  summary: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  created_at: Timestamp,
})
export type Artifact = typeof Artifact.Type

export const CreateArtifactPayload = Schema.Struct({
  workspace_id: WorkspaceId,
  work_id: WorkId,
  kind: ArtifactKind,
  media_type: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  summary: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
  content: Schema.optionalWith(Schema.String, {
    as: 'Option',
    nullable: true,
  }),
})
export type CreateArtifactPayload = typeof CreateArtifactPayload.Type

export const UpdateArtifactPayload = Schema.Struct({
  kind: ArtifactKind,
  media_type: Artifact.fields.media_type,
  summary: Artifact.fields.summary,
  content: CreateArtifactPayload.fields.content,
})
export type UpdateArtifactPayload = typeof UpdateArtifactPayload.Type
