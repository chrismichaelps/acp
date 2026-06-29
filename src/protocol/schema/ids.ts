/** @Acp.Protocol.Ids — branded identifiers for every entity */
import { Schema } from 'effect'

export const WorkId = Schema.String.pipe(Schema.brand('WorkId'))
export type WorkId = typeof WorkId.Type

export const WorkerId = Schema.String.pipe(Schema.brand('WorkerId'))
export type WorkerId = typeof WorkerId.Type

export const WorkspaceId = Schema.String.pipe(Schema.brand('WorkspaceId'))
export type WorkspaceId = typeof WorkspaceId.Type

export const LeaseId = Schema.String.pipe(Schema.brand('LeaseId'))
export type LeaseId = typeof LeaseId.Type

export const ArtifactId = Schema.String.pipe(Schema.brand('ArtifactId'))
export type ArtifactId = typeof ArtifactId.Type

export const CheckpointId = Schema.String.pipe(Schema.brand('CheckpointId'))
export type CheckpointId = typeof CheckpointId.Type

export const MemoryId = Schema.String.pipe(Schema.brand('MemoryId'))
export type MemoryId = typeof MemoryId.Type

export const ReviewId = Schema.String.pipe(Schema.brand('ReviewId'))
export type ReviewId = typeof ReviewId.Type

export const EventId = Schema.String.pipe(Schema.brand('EventId'))
export type EventId = typeof EventId.Type

export const SessionId = Schema.String.pipe(Schema.brand('SessionId'))
export type SessionId = typeof SessionId.Type
