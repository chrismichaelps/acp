/** @Acp.App.PolicyLayer — loads the configured policy into hook registration */
import { readFileSync } from 'node:fs'
import { Effect, Either, Layer, Option } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import { HookDispatcher, makeHookDispatcher } from '../domain/hooks/index.js'
import { loadPolicy, policyHooks } from '../domain/policy/index.js'

/**
 * Builds the host's hook dispatcher from the configured policy file.
 *
 * With no `ACP_POLICY_FILE` the dispatcher is empty and behaviour is unchanged.
 * With one, a document that fails to parse, omits its `default`, carries an
 * unjustified denial, or fails its own `match`/`notMatch` examples **aborts
 * startup**. That is intended: an access rule that silently stopped matching is
 * the failure operators cannot see, so loud at boot beats silent in production —
 * the same stance the [[ADR-0020-operational-contracts]] version guard takes.
 */
export const PolicyHooksLive: Layer.Layer<HookDispatcher, never, AppConfigTag> =
  Layer.effect(
    HookDispatcher,
    Effect.gen(function* () {
      const config = yield* AppConfigTag
      return yield* Option.match(config.policyFile, {
        onNone: () => Effect.succeed(makeHookDispatcher([])),
        onSome: (path) =>
          Effect.gen(function* () {
            const raw = yield* Effect.try({
              try: () => JSON.parse(readFileSync(path, 'utf8')) as unknown,
              catch: (cause) =>
                new Error(`cannot read policy file ${path}: ${String(cause)}`),
            }).pipe(Effect.orDie)

            const loaded = loadPolicy(raw)
            if (Either.isLeft(loaded)) {
              return yield* Effect.dieMessage(
                `invalid policy file ${path}: ${loaded.left.issues.join('; ')}`,
              )
            }
            return makeHookDispatcher(policyHooks(loaded.right))
          }),
      })
    }),
  )
