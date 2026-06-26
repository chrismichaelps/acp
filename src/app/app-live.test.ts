/** @Acp.App.Live.Test — composed application layer */
import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import { ArtifactService } from '../domain/artifacts/index.js'
import { CheckpointService } from '../domain/checkpoints/index.js'
import { EventStore } from '../domain/events/index.js'
import { LeaseService } from '../domain/leases/index.js'
import { ReviewService } from '../domain/reviews/index.js'
import { WorkUnitService } from '../domain/work-units/index.js'
import { WorkerService } from '../domain/workers/index.js'
import { WorkspaceService } from '../domain/workspaces/index.js'
import { Storage } from '../infrastructure/storage/index.js'
import { AppLive } from './index.js'

describe('AppLive', () => {
  it('provides the app config, storage, event store, and domain services', () => {
    const tags = Effect.gen(function* () {
      yield* AppConfigTag
      yield* Storage
      yield* EventStore
      yield* WorkUnitService
      yield* WorkerService
      yield* WorkspaceService
      yield* LeaseService
      yield* ArtifactService
      yield* CheckpointService
      yield* ReviewService
      return 'ok' as const
    })

    expect(Effect.runSync(Effect.provide(tags, AppLive))).toBe('ok')
  })
})
