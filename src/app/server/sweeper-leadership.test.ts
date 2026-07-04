/** @Acp.App.Server.SweeperLeadership.Test — sweeper leader-election adapters */
import { Cause, ConfigProvider, Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { AppConfigLive } from '../../config/app-config.js'
import {
  InProcessSweeperLeadershipLive,
  SweeperLeadership,
  SweeperLeadershipLive,
} from './sweeper-leadership.js'

const runWithConfig = <A, E, R>(
  program: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, E>,
  env: readonly (readonly [string, string])[],
) =>
  Effect.runSyncExit(
    Effect.provide(program, layer).pipe(
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map(env))),
    ),
  )

describe('SweeperLeadership', () => {
  it('runs effects under in-process leadership', () => {
    const result = Effect.runSync(
      Effect.gen(function* () {
        const leadership = yield* SweeperLeadership
        return yield* leadership.run(Effect.succeed('ran' as const))
      }).pipe(Effect.provide(InProcessSweeperLeadershipLive)),
    )

    expect(Option.getOrNull(result)).toBe('ran')
  })

  it('fails fast when postgres leadership is selected without a database url', () => {
    const exit = runWithConfig(
      SweeperLeadership,
      Layer.provide(SweeperLeadershipLive, AppConfigLive),
      [['ACP_STORAGE_ADAPTER', 'postgres']],
    )
    const failure = Option.getOrNull(
      Option.flatMap(Exit.causeOption(exit), Cause.failureOption),
    )

    if (failure?._tag !== 'StorageError') {
      throw new Error(
        'Expected postgres sweeper leadership to fail with StorageError',
      )
    }

    expect(failure.op).toBe('connect')
    expect(failure.cause).toContain(
      'ACP_DATABASE_URL is required for postgres sweeper leadership',
    )
  })
})
