/** @Acp.App.PolicyLayer — loads the configured policy into hook registration */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { Effect, Either, Layer, Option } from 'effect'
import { AppConfigTag } from '../config/app-config.js'
import {
  HookDispatcher,
  loadWebhookHooks,
  makeHookDispatcher,
  makeWebhookHook,
} from '../domain/hooks/index.js'
import type { Hook } from '../domain/hooks/index.js'
import { webhookTransport } from '../infrastructure/hooks/index.js'
import { loadPolicy, policyHooks } from '../domain/policy/index.js'
import type { PolicyDocument, PolicyOverlays } from '../domain/policy/index.js'

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
/** Reads and parses a configured JSON file, failing startup if it cannot. */
const readJson = (kind: string, path: string) =>
  Effect.try({
    try: () => JSON.parse(readFileSync(path, 'utf8')) as unknown,
    catch: (cause) =>
      new Error(`cannot read ${kind} file ${path}: ${String(cause)}`),
  }).pipe(Effect.orDie)

/**
 * Loads `<workspace_id>.json` overlays from a directory.
 *
 * A malformed overlay aborts startup exactly as a malformed host policy does:
 * an access rule that silently stopped applying is the failure an operator
 * cannot see.
 */
const overlaysFrom = (config: {
  readonly policyOverlayDir: Option.Option<string>
}): Effect.Effect<PolicyOverlays> =>
  Option.match(config.policyOverlayDir, {
    onNone: () => Effect.succeed<PolicyOverlays>(new Map()),
    onSome: (dir) =>
      Effect.gen(function* () {
        const files = yield* Effect.try({
          try: () =>
            readdirSync(dir).filter((name) => extname(name) === '.json'),
          catch: (cause) =>
            new Error(`cannot read overlay dir ${dir}: ${String(cause)}`),
        }).pipe(Effect.orDie)

        const overlays = new Map<string, PolicyDocument>()
        for (const file of files) {
          const path = join(dir, file)
          const loaded = loadPolicy(yield* readJson('policy overlay', path))
          if (Either.isLeft(loaded)) {
            return yield* Effect.dieMessage(
              `invalid policy overlay ${path}: ${loaded.left.issues.join('; ')}`,
            )
          }
          overlays.set(basename(file, '.json'), loaded.right)
        }
        return overlays
      }),
  })

const policyHooksFrom = (config: {
  readonly policyFile: Option.Option<string>
  readonly policyOverlayDir: Option.Option<string>
}) =>
  Option.match(config.policyFile, {
    onNone: () => Effect.succeed<readonly Hook[]>([]),
    onSome: (path) =>
      Effect.gen(function* () {
        const loaded = loadPolicy(yield* readJson('policy', path))
        if (Either.isLeft(loaded)) {
          return yield* Effect.dieMessage(
            `invalid policy file ${path}: ${loaded.left.issues.join('; ')}`,
          )
        }
        return policyHooks(loaded.right, yield* overlaysFrom(config))
      }),
  })

const webhookHooksFrom = (config: {
  readonly hooksFile: Option.Option<string>
}) =>
  Option.match(config.hooksFile, {
    onNone: () => Effect.succeed<readonly Hook[]>([]),
    onSome: (path) =>
      Effect.gen(function* () {
        const loaded = loadWebhookHooks(yield* readJson('hooks', path))
        if (Either.isLeft(loaded)) {
          return yield* Effect.dieMessage(
            `invalid hooks file ${path}: ${loaded.left.issues.join('; ')}`,
          )
        }
        return loaded.right.hooks.map((declaration) =>
          makeWebhookHook(declaration, webhookTransport(declaration.url)),
        )
      }),
  })

export const PolicyHooksLive: Layer.Layer<HookDispatcher, never, AppConfigTag> =
  Layer.effect(
    HookDispatcher,
    Effect.gen(function* () {
      const config = yield* AppConfigTag
      // Policy hooks are name-prefixed `00-`, so they evaluate before any
      // operator webhook at the same point — a local deny should not pay for a
      // network round trip first.
      return makeHookDispatcher([
        ...(yield* policyHooksFrom(config)),
        ...(yield* webhookHooksFrom(config)),
      ])
    }),
  )
