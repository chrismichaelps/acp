/** @Acp.App.Live — composed application layer */
import { Layer } from 'effect'
import { AppConfigLive } from '../config/app-config.js'
import { ArtifactServiceLive } from '../domain/artifacts/index.js'
import { CheckpointServiceLive } from '../domain/checkpoints/index.js'
import { CostServiceLive } from '../domain/cost/index.js'
import { EventStoreLive } from '../domain/events/index.js'
import { GrillServiceLive } from '../domain/grills/index.js'
import { LeaseServiceLive } from '../domain/leases/index.js'
import { ReviewCommentServiceLive } from '../domain/review-comments/index.js'
import { MemoryServiceLive } from '../domain/memory/index.js'
import { ReviewServiceLive } from '../domain/reviews/index.js'
import { SessionServiceLive } from '../domain/sessions/index.js'
import { PolicyHooksLive } from './policy-layer.js'
import { SandboxProviderLive } from './sandbox-layer.js'
import { SandboxServiceLive } from '../domain/sandbox/index.js'
import { WorkerIdentityServiceLive } from '../domain/identity/index.js'
import { WorkUnitServiceLive } from '../domain/work-units/index.js'
import { WorkerServiceLive } from '../domain/workers/index.js'
import { WorkspaceServiceLive } from '../domain/workspaces/index.js'
import { EventBrokerLive } from './event-broker-live.js'
import { StorageLive } from './storage-live.js'
import { SessionIssuerLive } from '../infrastructure/auth/index.js'

const HostHooksLive = Layer.provide(PolicyHooksLive, AppConfigLive)
const SandboxAdapterLive = Layer.provide(SandboxProviderLive, AppConfigLive)

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
const SessionIssuerProvidedLive = Layer.provideMerge(
  SessionIssuerLive,
  StorageAndConfigLive,
)

// The dispatcher is built from ACP_POLICY_FILE: absent means no hooks, so a
// host without a policy behaves exactly as one built before hooks existed.
// See [[ADR-0022-coordination-hooks]] and [[ADR-0023-resource-access-policy]].
// Identity sits under work units: a claim is attributed after the session has
// already authorized it — see [[ADR-0024-worker-identity-provenance]].
const WorkerIdentityProvidedLive = Layer.provideMerge(
  WorkerIdentityServiceLive,
  Layer.mergeAll(
    WorkerServiceLive.pipe(Layer.provide(StorageProvidedLive)),
    AppConfigLive,
  ),
)

const CostProvidedLive = Layer.provideMerge(
  CostServiceLive,
  EventStoreProvidedLive,
)

const WorkUnitProvidedLive = Layer.provideMerge(
  WorkUnitServiceLive,
  Layer.mergeAll(
    EventStoreProvidedLive,
    HostHooksLive,
    WorkerIdentityProvidedLive,
    CostProvidedLive,
  ),
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
  Layer.mergeAll(EventStoreProvidedLive, StorageAndConfigLive, HostHooksLive),
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
  Layer.mergeAll(
    ReviewCommentProvidedLive,
    EventStoreProvidedLive,
    WorkerIdentityProvidedLive,
  ),
)
const MemoryProvidedLive = Layer.provideMerge(
  MemoryServiceLive,
  EventStoreProvidedLive,
)
const ReviewProvidedLive = Layer.provideMerge(
  ReviewServiceLive,
  Layer.merge(WorkUnitProvidedLive, HostHooksLive),
)

// The sandbox service needs work units, leases, the configured adapter, and
// config; nothing provisions a sandbox unless an endpoint asks it to.
const SandboxProvidedLive = Layer.provideMerge(
  SandboxServiceLive,
  Layer.mergeAll(
    WorkUnitProvidedLive,
    LeaseProvidedLive,
    SandboxAdapterLive,
    AppConfigLive,
    CostProvidedLive,
  ),
)

export const AppLive = Layer.mergeAll(
  AppConfigLive,
  StorageProvidedLive,
  EventBrokerProvidedLive,
  EventStoreProvidedLive,
  CostProvidedLive,
  SessionIssuerProvidedLive,
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
  SandboxProvidedLive,
)
