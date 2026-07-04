/** @Acp.Domain.Artifacts.Service.Test — Artifact registry + content bounds */
import { describe, expect, it } from 'vitest'
import { Chunk, Duration, Effect, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import {
  EventStore,
  EventStoreLive,
  InProcessEventBrokerLive,
} from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import {
  ArtifactId,
  CreateArtifactPayload,
  Timestamp,
  UpdateArtifactPayload,
  WorkerId,
  WorkspaceId,
  WorkId,
} from '../../protocol/schema/index.js'
import { ArtifactService, ArtifactServiceLive } from './index.js'
import type { Event } from '../../protocol/schema/index.js'

const TestConfigLive = Layer.succeed(AppConfigTag, {
  port: 4317,
  logLevel: 'info' as const,
  storageAdapter: 'memory' as const,
  eventBroker: 'in-process' as const,
  sqlitePath: 'acp.sqlite',
  databaseUrl: Option.none(),
  defaultLeaseTtl: Duration.minutes(15),
  eventRetentionDays: 30,
  maxArtifactSizeBytes: 16,
  sseHeartbeat: Duration.seconds(15),
  sessionTtl: Duration.hours(1),
  sweepInterval: Duration.seconds(60),
  requireAuth: false,
  requireWorkspaceBindings: false,
})

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  Layer.merge(InMemoryStorageLive, InProcessEventBrokerLive),
)
const ArtifactDependenciesLive = Layer.provideMerge(
  StorageAndEventsLive,
  TestConfigLive,
)
const TestLive = Layer.provideMerge(
  ArtifactServiceLive,
  ArtifactDependenciesLive,
)

const runSync = <A, E>(
  program: Effect.Effect<A, E, ArtifactService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const artifactId = Schema.decodeUnknownSync(ArtifactId)('artifact_patch')
const otherArtifactId = Schema.decodeUnknownSync(ArtifactId)('artifact_log')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_artifact')
const otherWorkspaceId =
  Schema.decodeUnknownSync(WorkspaceId)('workspace_other')
const workId = Schema.decodeUnknownSync(WorkId)('work_artifact')
const otherWorkId = Schema.decodeUnknownSync(WorkId)('work_other')
const actor = Schema.decodeUnknownSync(WorkerId)('agent_codex')
const now = Schema.decodeUnknownSync(Timestamp)('2026-06-26T04:00:00.000Z')
const later = Schema.decodeUnknownSync(Timestamp)('2026-06-26T04:01:00.000Z')

const payload = Schema.decodeUnknownSync(CreateArtifactPayload)({
  workspace_id: workspaceId,
  work_id: workId,
  kind: 'patch',
  media_type: 'text/x-patch',
  summary: 'Fix auth redirect',
  content: 'diff --git a',
})

const createInput = (id = artifactId, body = payload) => ({
  id,
  payload: body,
  createdBy: actor,
  now,
})

describe('ArtifactService', () => {
  it('creates artifact metadata, stores content, and emits artifact.created', () => {
    const result = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        const events = yield* EventStore
        const created = yield* artifacts.create(createInput())
        const stored = yield* artifacts.get(artifactId)
        const content = yield* artifacts.readContent(artifactId)
        const log = yield* events.readAfter(workspaceId, 0)
        return { created, stored, content, log }
      }),
    )

    expect(result.created.uri).toBe('acp://artifacts/artifact_patch')
    expect(Option.getOrNull(result.stored)).toEqual(result.created)
    expect(Option.getOrNull(result.content)).toBe('diff --git a')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['artifact.created'])
  })

  it('creates an external artifact reference without storing private content', () => {
    const result = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        const events = yield* EventStore
        const created = yield* artifacts.create(
          createInput(
            otherArtifactId,
            Schema.decodeUnknownSync(CreateArtifactPayload)({
              workspace_id: workspaceId,
              work_id: workId,
              kind: 'pull_request',
              uri: 'https://example.com/acp/artifacts/pull-42',
              summary: 'Review PR',
            }),
          ),
        )
        const content = yield* artifacts.readContent(otherArtifactId)
        const log = yield* events.readAfter(workspaceId, 0)
        return { created, content, log }
      }),
    )

    expect(result.created.uri).toBe('https://example.com/acp/artifacts/pull-42')
    expect(result.created.kind).toBe('pull_request')
    expect(Option.isNone(result.content)).toBe(true)
    expect(Chunk.toReadonlyArray(result.log)[0]?.data).toMatchObject({
      uri: 'https://example.com/acp/artifacts/pull-42',
    })
  })

  it('rejects artifact creates without content or an external uri', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const artifacts = yield* ArtifactService
          return yield* artifacts.create(
            createInput(
              otherArtifactId,
              Schema.decodeUnknownSync(CreateArtifactPayload)({
                workspace_id: workspaceId,
                work_id: workId,
                kind: 'log',
                summary: 'Test output',
              }),
            ),
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('ValidationError')
    }
  })

  it('rejects content larger than the configured artifact limit', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const artifacts = yield* ArtifactService
          return yield* artifacts.create(
            createInput(
              artifactId,
              Schema.decodeUnknownSync(CreateArtifactPayload)({
                workspace_id: workspaceId,
                work_id: workId,
                kind: 'log',
                content: 'this content is too large',
              }),
            ),
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('ValidationError')
    }
  })

  it('lists artifacts by work and workspace', () => {
    const result = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        yield* artifacts.create(createInput())
        yield* artifacts.create(
          createInput(
            otherArtifactId,
            Schema.decodeUnknownSync(CreateArtifactPayload)({
              workspace_id: workspaceId,
              work_id: otherWorkId,
              kind: 'log',
              uri: 'https://ci.example.test/logs/1',
            }),
          ),
        )
        yield* artifacts.create(
          createInput(
            Schema.decodeUnknownSync(ArtifactId)('artifact_other_workspace'),
            Schema.decodeUnknownSync(CreateArtifactPayload)({
              workspace_id: otherWorkspaceId,
              work_id: otherWorkId,
              kind: 'markdown',
              uri: 'https://ci.example.test/notes/1',
            }),
          ),
        )
        const forWork = yield* artifacts.listForWork(workId)
        const forWorkspace = yield* artifacts.listForWorkspace(workspaceId)
        return { forWork, forWorkspace }
      }),
    )

    expect(result.forWork.map((artifact) => artifact.id)).toEqual([artifactId])
    expect(result.forWorkspace.map((artifact) => artifact.id).sort()).toEqual([
      otherArtifactId,
      artifactId,
    ])
  })

  it('updates metadata and content while preserving artifact identity', () => {
    const result = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        const events = yield* EventStore
        const created = yield* artifacts.create(createInput())
        const updated = yield* artifacts.update(
          artifactId,
          Schema.decodeUnknownSync(UpdateArtifactPayload)({
            kind: 'markdown',
            media_type: 'text/markdown',
            summary: 'Updated notes',
            content: 'updated content',
          }),
          actor,
          later,
        )
        const content = yield* artifacts.readContent(artifactId)
        const log = yield* events.readAfter(workspaceId, 0)
        return { created, updated, content, log }
      }),
    )

    expect(result.updated.id).toBe(result.created.id)
    expect(result.updated.uri).toBe(result.created.uri)
    expect(result.updated.created_at).toBe(result.created.created_at)
    expect(result.updated.created_by).toBe(result.created.created_by)
    expect(result.updated.kind).toBe('markdown')
    expect(Option.getOrNull(result.updated.media_type)).toBe('text/markdown')
    expect(Option.getOrNull(result.updated.summary)).toBe('Updated notes')
    expect(Option.getOrNull(result.content)).toBe('updated content')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['artifact.created', 'artifact.updated'])
  })

  it('preserves stored content when update changes metadata only', () => {
    const content = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        yield* artifacts.create(createInput())
        yield* artifacts.update(
          artifactId,
          Schema.decodeUnknownSync(UpdateArtifactPayload)({
            kind: 'patch',
          }),
          actor,
          later,
        )
        return yield* artifacts.readContent(artifactId)
      }),
    )

    expect(Option.getOrNull(content)).toBe('diff --git a')
  })

  it('switches an artifact to an external uri and clears stored content', () => {
    const result = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        yield* artifacts.create(createInput())
        const updated = yield* artifacts.update(
          artifactId,
          Schema.decodeUnknownSync(UpdateArtifactPayload)({
            kind: 'pull_request',
            uri: 'https://example.com/acp/artifacts/pull-42',
            summary: 'Ready for review',
          }),
          actor,
          later,
        )
        const content = yield* artifacts.readContent(artifactId)
        return { updated, content }
      }),
    )

    expect(result.updated.uri).toBe('https://example.com/acp/artifacts/pull-42')
    expect(Option.isNone(result.content)).toBe(true)
  })

  it('switches an external artifact back to host-stored content', () => {
    const result = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        yield* artifacts.create(
          createInput(
            artifactId,
            Schema.decodeUnknownSync(CreateArtifactPayload)({
              workspace_id: workspaceId,
              work_id: workId,
              kind: 'pull_request',
              uri: 'https://example.com/acp/artifacts/pull-42',
            }),
          ),
        )
        const updated = yield* artifacts.update(
          artifactId,
          Schema.decodeUnknownSync(UpdateArtifactPayload)({
            kind: 'markdown',
            content: 'local notes',
          }),
          actor,
          later,
        )
        const content = yield* artifacts.readContent(artifactId)
        return { updated, content }
      }),
    )

    expect(result.updated.uri).toBe('acp://artifacts/artifact_patch')
    expect(Option.getOrNull(result.content)).toBe('local notes')
  })

  it('rejects updated content larger than the configured artifact limit', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const artifacts = yield* ArtifactService
          yield* artifacts.create(createInput())
          return yield* artifacts.update(
            artifactId,
            Schema.decodeUnknownSync(UpdateArtifactPayload)({
              kind: 'log',
              content: 'this content is too large',
            }),
            actor,
            later,
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('ValidationError')
    }
  })

  it('removes artifact metadata and content and emits artifact.deleted', () => {
    const result = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        const events = yield* EventStore
        yield* artifacts.create(createInput())
        const removed = yield* artifacts.remove(artifactId, actor, later)
        const stored = yield* artifacts.get(artifactId)
        const content = yield* artifacts.readContent(artifactId)
        const log = yield* events.readAfter(workspaceId, 0)
        return { removed, stored, content, log }
      }),
    )

    expect(result.removed.id).toBe(artifactId)
    expect(Option.isNone(result.stored)).toBe(true)
    expect(Option.isNone(result.content)).toBe(true)
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['artifact.created', 'artifact.deleted'])
  })

  it('returns Option.none for a missing artifact', () => {
    const stored = runSync(
      Effect.gen(function* () {
        const artifacts = yield* ArtifactService
        return yield* artifacts.get(
          Schema.decodeUnknownSync(ArtifactId)('artifact_missing'),
        )
      }),
    )

    expect(Option.isNone(stored)).toBe(true)
  })

  it('fails remove with NotFoundError for a missing artifact', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const artifacts = yield* ArtifactService
          return yield* artifacts.remove(
            Schema.decodeUnknownSync(ArtifactId)('artifact_missing'),
            actor,
            later,
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('NotFoundError')
    }
  })
})
