/** @Acp.Domain.Identity.TestSupport — a ready identity layer for test graphs */
import { Layer } from 'effect'
import { TestAppConfigLive } from '../../config/app-config-test-support.js'
import { InMemoryStorageLive } from '../../infrastructure/storage/index.js'
import { WorkerServiceLive } from '../workers/index.js'
import { WorkerIdentityServiceLive } from './worker-identity-service.js'

/**
 * Identity with signatures unenforced, over its own worker store.
 *
 * Uses `Layer.provide`, not `provideMerge`: exporting its own AppConfigTag would
 * silently override a caller's parameterised config — that is exactly how the
 * spawn-graph depth cap got shadowed by the default.
 *
 * Self-contained because with enforcement off and no assertion supplied,
 * verification returns without reading a worker at all — so a test graph that
 * does not care about provenance needs no worker fixtures.
 */
export const TestIdentityLive = Layer.provide(
  WorkerIdentityServiceLive,
  Layer.merge(
    WorkerServiceLive.pipe(Layer.provide(InMemoryStorageLive)),
    TestAppConfigLive(),
  ),
)
