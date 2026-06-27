/** @Acp.App.Server.Sweeper — background TTL eviction daemon */
import { Effect, Layer } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { LeaseService } from '../../domain/leases/index.js'
import { SessionService } from '../../domain/sessions/index.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import type { Lease, Session, WorkerId } from '../../protocol/schema/index.js'
import { IdClock } from './identity.js'

const systemActor = 'worker_system' as WorkerId

export interface SweepResult {
  readonly evictedSessions: readonly Session[]
  readonly expiredLeases: readonly Lease[]
}

/**
 * One deterministic sweep: read `now`, evict sessions older than
 * `config.sessionTtl`, and lapse every due active lease (across all workspaces).
 * The unit of work — and the unit of test — behind {@link SweeperLive}.
 */
export const sweepOnce: Effect.Effect<
  SweepResult,
  StorageError,
  SessionService | LeaseService | AppConfigTag | IdClock
> = Effect.gen(function* () {
  const idClock = yield* IdClock
  const config = yield* AppConfigTag
  const sessions = yield* SessionService
  const leases = yield* LeaseService

  const now = yield* idClock.now
  const evictedSessions = yield* sessions.evictExpired(now, config.sessionTtl)
  const expiredLeases = yield* leases.expireAllDue(systemActor, now)

  return { evictedSessions, expiredLeases }
})

/**
 * Forks {@link sweepOnce} on a `config.sweepInterval` cadence as a daemon scoped
 * to the layer (the host). A failed sweep is logged and swallowed so a single bad
 * tick never terminates the loop. Merged into {@link HttpAppLive} over the shared
 * app runtime so it evicts from the same store the router serves.
 */
export const SweeperLive: Layer.Layer<
  never,
  never,
  SessionService | LeaseService | AppConfigTag | IdClock
> = Layer.scopedDiscard(
  Effect.gen(function* () {
    const config = yield* AppConfigTag
    const tick = sweepOnce.pipe(
      Effect.catchAllCause((cause) =>
        Effect.logError('sweep failed', cause).pipe(Effect.as(undefined)),
      ),
    )
    yield* Effect.forkScoped(
      Effect.forever(Effect.zipRight(Effect.sleep(config.sweepInterval), tick)),
    )
  }),
)
