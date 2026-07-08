/** @Acp.App.Live — composed application layer */
import { Layer } from 'effect'
import { AppConfigLive } from '../config/app-config.js'
import { ArtifactServiceLive } from '../domain/artifacts/index.js'
import { CheckpointServiceLive } from '../domain/checkpoints/index.js'
import { EventStoreLive } from '../domain/events/index.js'
import { GrillServiceLive } from '../domain/grills/index.js'
import { LeaseServiceLive } from '../domain/leases/index.js'
import { ReviewCommentServiceLive } from '../domain/review-comments/index.js'
import { MemoryServiceLive } from '../domain/memory/index.js'
import { ReviewServiceLive } from '../domain/reviews/index.js'
import { SessionServiceLive } from '../domain/sessions/index.js'
import { WorkUnitServiceLive } from '../domain/work-units/index.js'
import { WorkerServiceLive } from '../domain/workers/index.js'
import { WorkspaceServiceLive } from '../domain/workspaces/index.js'
import { EventBrokerLive } from './event-broker-live.js'
import { StorageLive } from './storage-live.js'

const StorageProvidedLive = Layer.provide(StorageLive, AppConfigLive)
const StorageAndConfigLive = Layer.merge(StorageProvidedLive, AppConfigLive)
const EventBrokerProvidedLive = Layer.provideMerge(
  EventBrokerLive,
  StorageAndConfigLive,
)
const EventStoreProvidedLive = Layer.provideMerge(
  EventStoreLive,
  Layer.merge(StorageProvidedLive, EventBrokerProvidedLive),
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
const ReviewCommentProvidedLive = Layer.provideMerge(
  ReviewCommentServiceLive,
  EventStoreProvidedLive,
)
const GrillProvidedLive = Layer.provideMerge(
  GrillServiceLive,
  Layer.merge(ReviewCommentProvidedLive, EventStoreProvidedLive),
)
const MemoryProvidedLive = Layer.provideMerge(
  MemoryServiceLive,
  EventStoreProvidedLive,
)
const ReviewProvidedLive = Layer.provideMerge(
  ReviewServiceLive,
  WorkUnitProvidedLive,
)

export const AppLive = Layer.mergeAll(
  AppConfigLive,
  StorageProvidedLive,
  EventBrokerProvidedLive,
  EventStoreProvidedLive,
  WorkUnitProvidedLive,
  WorkerServiceLive.pipe(Layer.provide(StorageProvidedLive)),
  SessionServiceLive.pipe(Layer.provide(StorageProvidedLive)),
  WorkspaceProvidedLive,
  LeaseProvidedLive,
  ArtifactProvidedLive,
  CheckpointProvidedLive,
  ReviewCommentProvidedLive,
  GrillProvidedLive,
  MemoryProvidedLive,
  ReviewProvidedLive,
)
