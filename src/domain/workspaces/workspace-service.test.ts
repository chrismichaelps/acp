/** @Acp.Domain.Workspaces.Service.Test — Workspace registry + events */
import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Layer, Option, Schema } from 'effect'
import { EventStore, EventStoreLive } from '../events/index.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import {
  Timestamp,
  WorkerId,
  Workspace,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { WorkspaceService, WorkspaceServiceLive } from './index.js'
import type { Event } from '../../protocol/schema/index.js'

const StorageAndEventsLive = Layer.provideMerge(
  EventStoreLive,
  InMemoryStorageLive,
)
const TestLive = Layer.provideMerge(WorkspaceServiceLive, StorageAndEventsLive)

const runSync = <A, E>(
  program: Effect.Effect<A, E, WorkspaceService | EventStore>,
): A => Effect.runSync(Effect.provide(program, TestLive))

const actor = Schema.decodeUnknownSync(WorkerId)('agent_claude_code')
const now = Schema.decodeUnknownSync(Timestamp)('2026-06-26T02:00:00Z')
const later = Schema.decodeUnknownSync(Timestamp)('2026-06-26T02:01:00Z')

const decodeWorkspace = (name = 'acme/web') =>
  Schema.decodeUnknownSync(Workspace)({
    id: 'workspace_123',
    name,
    kind: 'git_repository',
    uri: 'git+https://example.com/acme/web.git',
    default_branch: 'main',
    metadata: { provider: 'github' },
  })

const workspaceId = decodeWorkspace().id

describe('WorkspaceService', () => {
  it('creates a workspace and emits workspace.created', () => {
    const result = runSync(
      Effect.gen(function* () {
        const workspaces = yield* WorkspaceService
        const events = yield* EventStore
        const created = yield* workspaces.create(decodeWorkspace(), actor, now)
        const stored = yield* workspaces.get(workspaceId)
        const log = yield* events.readAfter('workspace_123', 0)
        return { created, stored, log }
      }),
    )

    expect(Option.getOrNull(result.stored)).toEqual(result.created)
    expect(result.created.state).toBe('active')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['workspace.created'])
  })

  it('lists all created workspaces', () => {
    const ids = runSync(
      Effect.gen(function* () {
        const workspaces = yield* WorkspaceService
        yield* workspaces.create(decodeWorkspace(), actor, now)
        yield* workspaces.create(
          Schema.decodeUnknownSync(Workspace)({
            id: 'workspace_456',
            name: 'acme/api',
            kind: 'directory',
            uri: 'file:///srv/acme/api',
            metadata: {},
          }),
          actor,
          now,
        )
        const all = yield* workspaces.list()
        return all.map((workspace) => workspace.id).sort()
      }),
    )

    expect(ids).toEqual(['workspace_123', 'workspace_456'])
  })

  it('updates an existing workspace and emits workspace.updated', () => {
    const result = runSync(
      Effect.gen(function* () {
        const workspaces = yield* WorkspaceService
        const events = yield* EventStore
        yield* workspaces.create(decodeWorkspace('acme/web'), actor, now)
        const updated = yield* workspaces.update(
          decodeWorkspace('acme/web-renamed'),
          actor,
          later,
        )
        const log = yield* events.readAfter('workspace_123', 0)
        return { updated, log }
      }),
    )

    expect(result.updated.name).toBe('acme/web-renamed')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['workspace.created', 'workspace.updated'])
  })

  it('archives a workspace and emits workspace.archived', () => {
    const result = runSync(
      Effect.gen(function* () {
        const workspaces = yield* WorkspaceService
        const events = yield* EventStore
        yield* workspaces.create(decodeWorkspace('acme/web'), actor, now)
        const archived = yield* workspaces.archive(workspaceId, actor, later)
        const stored = yield* workspaces.get(workspaceId)
        const log = yield* events.readAfter('workspace_123', 0)
        return { archived, stored, log }
      }),
    )

    expect(result.archived.state).toBe('archived')
    expect(Option.getOrNull(result.stored)?.state).toBe('archived')
    expect(
      Chunk.toReadonlyArray(result.log).map((event: Event) => event.type),
    ).toEqual(['workspace.created', 'workspace.archived'])
  })

  it('rejects updates after archive', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const workspaces = yield* WorkspaceService
          yield* workspaces.create(decodeWorkspace('acme/web'), actor, now)
          yield* workspaces.archive(workspaceId, actor, later)
          return yield* workspaces.update(
            decodeWorkspace('acme/web-renamed'),
            actor,
            later,
          )
        }),
      ),
    )

    expect(error._tag).toBe('Left')
    if (error._tag === 'Left') {
      expect(error.left._tag).toBe('InvalidStateTransitionError')
    }
  })

  it('returns Option.none for an unknown workspace', () => {
    const stored = runSync(
      Effect.gen(function* () {
        const workspaces = yield* WorkspaceService
        return yield* workspaces.get(
          Schema.decodeUnknownSync(WorkspaceId)('workspace_missing'),
        )
      }),
    )

    expect(Option.isNone(stored)).toBe(true)
  })

  it('fails update with NotFoundError for a missing workspace', () => {
    const error = runSync(
      Effect.either(
        Effect.gen(function* () {
          const workspaces = yield* WorkspaceService
          return yield* workspaces.update(
            Schema.decodeUnknownSync(Workspace)({
              id: 'workspace_missing',
              name: 'ghost',
              kind: 'directory',
              uri: 'file:///tmp/ghost',
              metadata: {},
            }),
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
