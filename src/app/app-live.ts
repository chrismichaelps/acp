/** @Acp.App.Live — composed in-memory application layer */
import { Layer } from 'effect'
import { AppConfigLive } from '../config/app-config.js'
import { ArtifactServiceLive } from '../domain/artifacts/index.js'
import { CheckpointServiceLive } from '../domain/checkpoints/index.js'
import { EventStoreLive } from '../domain/events/index.js'
import { LeaseServiceLive } from '../domain/leases/index.js'
import { ReviewServiceLive } from '../domain/reviews/index.js'
import { SessionServiceLive } from '../domain/sessions/index.js'
import { WorkUnitServiceLive } from '../domain/work-units/index.js'
import { WorkerServiceLive } from '../domain/workers/index.js'
import { WorkspaceServiceLive } from '../domain/workspaces/index.js'
import { InMemoryStorageLive } from '../infrastructure/storage/index.js'

const StorageAndConfigLive = Layer.merge(InMemoryStorageLive, AppConfigLive)
const EventStoreProvidedLive = Layer.provideMerge(
  EventStoreLive,
  InMemoryStorageLive,
)

const WorkUnitProvidedLive = Layer.provideMerge(
  WorkUnitServiceLive,
  EventStoreProvidedLive,
)
const WorkspaceProvidedLive = Layer.provideMerge(
  WorkspaceServiceLive,
  EventStoreProvidedLive,
)
const ArtifactProvidedLive = Layer.provideMerge(
  ArtifactServiceLive,
  Layer.merge(EventStoreProvidedLive, StorageAndConfigLive),
)
const LeaseProvidedLive = Layer.provideMerge(
  LeaseServiceLive,
  Layer.merge(EventStoreProvidedLive, StorageAndConfigLive),
)
const CheckpointProvidedLive = Layer.provideMerge(
  CheckpointServiceLive,
  EventStoreProvidedLive,
)
const ReviewProvidedLive = Layer.provideMerge(
  ReviewServiceLive,
  WorkUnitProvidedLive,
)

export const AppLive = Layer.mergeAll(
  AppConfigLive,
  InMemoryStorageLive,
  EventStoreProvidedLive,
  WorkUnitProvidedLive,
  WorkerServiceLive.pipe(Layer.provide(InMemoryStorageLive)),
  SessionServiceLive.pipe(Layer.provide(InMemoryStorageLive)),
  WorkspaceProvidedLive,
  LeaseProvidedLive,
  ArtifactProvidedLive,
  CheckpointProvidedLive,
  ReviewProvidedLive,
)
