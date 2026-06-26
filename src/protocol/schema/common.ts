/** @Acp.Protocol.Common — shared closed vocabularies and value objects */
import { Schema } from 'effect'

export const Timestamp = Schema.String.pipe(Schema.brand('Timestamp'))
export type Timestamp = typeof Timestamp.Type

export const Priority = Schema.Literal('low', 'normal', 'high', 'urgent')
export type Priority = typeof Priority.Type

export const WorkerKind = Schema.Literal(
  'human',
  'agent',
  'bot',
  'ci',
  'system',
)
export type WorkerKind = typeof WorkerKind.Type

export const WorkerStatus = Schema.Literal(
  'online',
  'idle',
  'busy',
  'blocked',
  'offline',
)
export type WorkerStatus = typeof WorkerStatus.Type

export const WorkState = Schema.Literal(
  'open',
  'claimed',
  'running',
  'blocked',
  'needs_review',
  'changes_requested',
  'approved',
  'rejected',
  'completed',
  'cancelled',
)
export type WorkState = typeof WorkState.Type

export const LeaseState = Schema.Literal(
  'active',
  'expired',
  'released',
  'revoked',
)
export type LeaseState = typeof LeaseState.Type

export const ResourceKind = Schema.Literal(
  'file',
  'directory',
  'branch',
  'worktree',
  'task',
  'service',
  'database_migration',
  'custom',
)
export type ResourceKind = typeof ResourceKind.Type

export const ArtifactKind = Schema.Literal(
  'patch',
  'diff',
  'commit',
  'pull_request',
  'test_report',
  'log',
  'screenshot',
  'markdown',
  'json',
  'binary',
  'custom',
)
export type ArtifactKind = typeof ArtifactKind.Type

export const ReviewState = Schema.Literal(
  'requested',
  'approved',
  'rejected',
  'changes_requested',
  'cancelled',
)
export type ReviewState = typeof ReviewState.Type

export const WorkspaceKind = Schema.Literal(
  'git_repository',
  'git_worktree',
  'directory',
  'container',
  'cloud_sandbox',
  'ci_job',
)
export type WorkspaceKind = typeof WorkspaceKind.Type

export const Resource = Schema.Struct({
  kind: ResourceKind,
  uri: Schema.NonEmptyString,
})
export type Resource = typeof Resource.Type
