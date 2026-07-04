/** @Acp.App.Server.SweeperLeadership — single-writer guard for sweeper ticks */
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { Context, Effect, Layer, Option, Redacted } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { StorageError } from '../../protocol/errors/protocol-error.js'

interface LockRow {
  readonly acquired: boolean
}

export interface SweeperLeadershipApi {
  readonly run: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<Option.Option<A>, E | StorageError, R>
}

export class SweeperLeadership extends Context.Tag('SweeperLeadership')<
  SweeperLeadership,
  SweeperLeadershipApi
>() {}

const lockNamespace = 1_094_929_220
const lockKey = 1

const storageError = (op: string) => (cause: unknown) =>
  new StorageError({ op, cause: String(cause) })

const makePostgres = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const run: SweeperLeadershipApi['run'] = (effect) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const rows = yield* sql<LockRow>`
            SELECT pg_try_advisory_xact_lock(${lockNamespace}, ${lockKey}) AS acquired
          `.pipe(Effect.mapError(storageError('sweeper_leader_lock')))

          if (!rows[0]?.acquired) {
            yield* Effect.logDebug('sweeper leadership held elsewhere').pipe(
              Effect.annotateLogs({ component: 'sweeper' }),
            )
            return Option.none()
          }

          return Option.some(yield* effect)
        }),
      )
      .pipe(
        Effect.catchTag('SqlError', (error) =>
          Effect.fail(storageError('sweeper_leader_transaction')(error)),
        ),
      )

  return { run } satisfies SweeperLeadershipApi
})

export const InProcessSweeperLeadershipLive: Layer.Layer<SweeperLeadership> =
  Layer.succeed(SweeperLeadership, {
    run: (effect) => Effect.map(effect, Option.some),
  } satisfies SweeperLeadershipApi)

export const makePostgresSweeperLeadershipLive = (
  url: string,
): Layer.Layer<SweeperLeadership, StorageError> =>
  Layer.effect(SweeperLeadership, makePostgres).pipe(
    Layer.provide(PgClient.layer({ url: Redacted.make(url) })),
    Layer.mapError(storageError('sweeper_leader_connect')),
  )

export const SweeperLeadershipLive: Layer.Layer<
  SweeperLeadership,
  StorageError,
  AppConfigTag
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* AppConfigTag
    if (config.storageAdapter !== 'postgres') {
      return InProcessSweeperLeadershipLive
    }

    return Option.match(config.databaseUrl, {
      onNone: () =>
        Layer.fail(
          new StorageError({
            op: 'connect',
            cause:
              'ACP_DATABASE_URL is required for postgres sweeper leadership',
          }),
        ),
      onSome: makePostgresSweeperLeadershipLive,
    })
  }),
)
