/** @Acp.Domain.Artifacts.Service — Artifact metadata + content registry */
import { Chunk, Context, Effect, Layer, Option, Schema } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { EventStore } from '../events/index.js'
import { Storage } from '../../infrastructure/storage/index.js'
import {
  NotFoundError,
  StorageError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import { Artifact, Event } from '../../protocol/schema/index.js'
import type {
  ArtifactId,
  CreateArtifactPayload,
  EventType,
  Timestamp,
  UpdateArtifactPayload,
  WorkerId,
  WorkspaceId,
  WorkId,
} from '../../protocol/schema/index.js'

export interface CreateArtifactInput {
  readonly id: ArtifactId
  readonly payload: CreateArtifactPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export type ArtifactServiceError =
  | ValidationError
  | NotFoundError
  | StorageError

export interface ArtifactServiceApi {
  readonly create: (
    input: CreateArtifactInput,
  ) => Effect.Effect<Artifact, ValidationError | StorageError>
  readonly get: (
    artifactId: ArtifactId,
  ) => Effect.Effect<Option.Option<Artifact>, StorageError>
  readonly readContent: (
    artifactId: ArtifactId,
  ) => Effect.Effect<Option.Option<string>, StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect.Effect<readonly Artifact[], StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect.Effect<readonly Artifact[], StorageError>
  readonly remove: (
    artifactId: ArtifactId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<Artifact, NotFoundError | StorageError>
  readonly update: (
    artifactId: ArtifactId,
    payload: UpdateArtifactPayload,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect.Effect<Artifact, ValidationError | NotFoundError | StorageError>
}

export class ArtifactService extends Context.Tag('ArtifactService')<
  ArtifactService,
  ArtifactServiceApi
>() {}

const collection = 'artifact'
const contentCollection = 'artifact_content'

const decodeStoredArtifact = (value: unknown) =>
  Schema.decodeUnknown(Artifact)(value).pipe(
    Effect.mapError(
      (error) =>
        new StorageError({
          op: 'decode_artifact',
          cause: String(error),
        }),
    ),
  )

const artifactUri = (id: ArtifactId) => `acp://artifacts/${id}`

const byteLength = (value: string) => new TextEncoder().encode(value).byteLength

const make = Effect.gen(function* () {
  const storage = yield* Storage
  const events = yield* EventStore
  const config = yield* AppConfigTag

  const encodeArtifact = (artifact: Artifact) =>
    Schema.encode(Artifact)(artifact).pipe(
      Effect.mapError(
        (error) =>
          new StorageError({
            op: 'encode_artifact',
            cause: String(error),
          }),
      ),
    )

  const save = (artifact: Artifact) =>
    Effect.flatMap(encodeArtifact(artifact), (encoded) =>
      storage.put(collection, artifact.id, encoded),
    )

  const appendArtifactEvent = (
    artifact: Artifact,
    actor: WorkerId,
    timestamp: Timestamp,
    type: EventType,
  ) =>
    Effect.flatMap(
      Schema.decodeUnknown(Event)({
        id: `event_${artifact.id}_${type}_${timestamp}`,
        type,
        workspace_id: artifact.workspace_id,
        work_id: artifact.work_id,
        actor,
        timestamp,
        seq: 0,
        data: {
          artifact_id: artifact.id,
          kind: artifact.kind,
          uri: artifact.uri,
        },
      }).pipe(
        Effect.mapError(
          (error) =>
            new StorageError({
              op: 'decode_artifact_event',
              cause: String(error),
            }),
        ),
      ),
      (event) =>
        events.append({
          id: event.id,
          type: event.type,
          workspace_id: event.workspace_id,
          work_id: event.work_id,
          actor: event.actor,
          timestamp: event.timestamp,
          data: event.data,
        }),
    )

  const validateContentSize = (content: Option.Option<string>) =>
    Option.match(content, {
      onNone: () => Effect.void,
      onSome: (value) => {
        const size = byteLength(value)
        if (size <= config.maxArtifactSizeBytes) {
          return Effect.void
        }

        return Effect.fail(
          new ValidationError({
            issues: [
              `artifact content is ${String(size)} bytes; maximum is ${String(config.maxArtifactSizeBytes)}`,
            ],
          }),
        )
      },
    })

  const storeContent = (id: ArtifactId, content: Option.Option<string>) =>
    Option.match(content, {
      onNone: () => Effect.void,
      onSome: (value) => storage.put(contentCollection, id, value),
    })

  const replaceContent = (id: ArtifactId, content: Option.Option<string>) =>
    Option.match(content, {
      onNone: () => storage.remove(contentCollection, id),
      onSome: (value) => storage.put(contentCollection, id, value),
    })

  const get: ArtifactServiceApi['get'] = (artifactId) =>
    Effect.flatMap(storage.get(collection, artifactId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<Artifact>()),
        onSome: (value) => Effect.map(decodeStoredArtifact(value), Option.some),
      }),
    )

  const readContent: ArtifactServiceApi['readContent'] = (artifactId) =>
    Effect.flatMap(storage.get(contentCollection, artifactId), (stored) =>
      Option.match(stored, {
        onNone: () => Effect.succeed(Option.none<string>()),
        onSome: (value) =>
          typeof value === 'string'
            ? Effect.succeed(Option.some(value))
            : Effect.fail(
                new StorageError({
                  op: 'decode_artifact_content',
                  cause: 'stored content is not a string',
                }),
              ),
      }),
    )

  const all = () =>
    Effect.flatMap(storage.list(collection), (stored) =>
      Effect.forEach(Chunk.toReadonlyArray(stored), decodeStoredArtifact),
    )

  const listForWork: ArtifactServiceApi['listForWork'] = (workId) =>
    Effect.map(all(), (artifacts) =>
      artifacts.filter((artifact) => artifact.work_id === workId),
    )

  const listForWorkspace: ArtifactServiceApi['listForWorkspace'] = (
    workspaceId,
  ) =>
    Effect.map(all(), (artifacts) =>
      artifacts.filter((artifact) => artifact.workspace_id === workspaceId),
    )

  const create: ArtifactServiceApi['create'] = (input) => {
    const artifact: Artifact = {
      id: input.id,
      work_id: input.payload.work_id,
      workspace_id: input.payload.workspace_id,
      created_by: input.createdBy,
      kind: input.payload.kind,
      uri: artifactUri(input.id),
      media_type: input.payload.media_type,
      summary: input.payload.summary,
      created_at: input.now,
    }

    return Effect.gen(function* () {
      yield* validateContentSize(input.payload.content)
      yield* save(artifact)
      yield* storeContent(input.id, input.payload.content)
      yield* appendArtifactEvent(
        artifact,
        input.createdBy,
        input.now,
        'artifact.created',
      )
      return artifact
    })
  }

  const requireArtifact = (artifactId: ArtifactId) =>
    Effect.flatMap(get(artifactId), (artifact) =>
      Option.match(artifact, {
        onNone: () =>
          Effect.fail(
            new NotFoundError({ entity: 'artifact', id: artifactId }),
          ),
        onSome: Effect.succeed,
      }),
    )

  const remove: ArtifactServiceApi['remove'] = (artifactId, actor, now) =>
    Effect.flatMap(requireArtifact(artifactId), (artifact) =>
      Effect.gen(function* () {
        yield* storage.remove(collection, artifactId)
        yield* storage.remove(contentCollection, artifactId)
        yield* appendArtifactEvent(artifact, actor, now, 'artifact.deleted')
        return artifact
      }),
    )

  const update: ArtifactServiceApi['update'] = (
    artifactId,
    payload,
    actor,
    now,
  ) =>
    Effect.flatMap(requireArtifact(artifactId), (artifact) =>
      Effect.gen(function* () {
        yield* validateContentSize(payload.content)
        const updated: Artifact = {
          ...artifact,
          kind: payload.kind,
          media_type: payload.media_type,
          summary: payload.summary,
        }
        yield* save(updated)
        yield* replaceContent(artifactId, payload.content)
        yield* appendArtifactEvent(updated, actor, now, 'artifact.updated')
        return updated
      }),
    )

  return {
    create,
    get,
    readContent,
    listForWork,
    listForWorkspace,
    remove,
    update,
  } satisfies ArtifactServiceApi
})

export const ArtifactServiceLive: Layer.Layer<
  ArtifactService,
  never,
  Storage | EventStore | AppConfigTag
> = Layer.effect(ArtifactService, make)
