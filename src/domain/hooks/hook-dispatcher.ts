/** @Acp.Domain.Hooks.Dispatcher — sequential, fail-closed hook dispatch */
import { Context, Duration, Effect, Layer } from 'effect'
import { recordHookOutcome } from '../../infrastructure/metrics/index.js'
import { HookDeniedError } from '../../protocol/errors/protocol-error.js'
import { DEFAULT_HOOK_TIMEOUT_MS } from './hook.js'
import type { Hook, HookPayload, HookPoint } from './hook.js'

export interface HookDispatcherApi {
  /**
   * Runs every hook registered for `point`, in name order, and fails with
   * `HookDeniedError` if one aborts. Succeeds when no hook aborts, including
   * when none are registered.
   */
  readonly dispatch: (
    point: HookPoint,
    payload: HookPayload,
  ) => Effect.Effect<void, HookDeniedError>
}

export class HookDispatcher extends Context.Tag('HookDispatcher')<
  HookDispatcher,
  HookDispatcherApi
>() {}

const byName = (left: Hook, right: Hook): number =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0

/**
 * Builds a dispatcher over a fixed hook set.
 *
 * Dispatch is sequential rather than concurrent so a refusal is reproducible:
 * with concurrency, "which hook denied first" becomes a race, and the dogfood
 * scripts assert exact output. The first abort short-circuits the rest.
 */
export const makeHookDispatcher = (
  hooks: readonly Hook[],
): HookDispatcherApi => {
  const byPoint = new Map<HookPoint, readonly Hook[]>()
  for (const hook of hooks) {
    byPoint.set(hook.point, [...(byPoint.get(hook.point) ?? []), hook])
  }
  for (const [point, registered] of byPoint) {
    byPoint.set(point, [...registered].sort(byName))
  }

  const runOne = (
    hook: Hook,
    payload: HookPayload,
  ): Effect.Effect<void, HookDeniedError> =>
    hook.run(payload).pipe(
      Effect.timeoutTo({
        duration: Duration.millis(hook.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS),
        // A hung hook is refused, not waved through. A gate that disappears
        // under load is worse than no gate, because operators rely on it.
        onTimeout: () =>
          ({
            _tag: 'DenyAbort' as const,
            reason: `hook "${hook.name}" timed out after ${String(
              hook.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS,
            )}ms`,
          }) as const,
        onSuccess: (outcome) => outcome,
      }),
      Effect.flatMap((outcome) =>
        Effect.zipRight(
          recordHookOutcome({
            point: hook.point,
            hook: hook.name,
            outcome: outcome._tag,
          }),
          outcome._tag === 'DenyAbort'
            ? Effect.fail(
                new HookDeniedError({
                  point: hook.point,
                  hookName: hook.name,
                  reason: outcome.reason,
                }),
              )
            : Effect.void,
        ),
      ),
    )

  return {
    dispatch: (point, payload) =>
      Effect.forEach(
        byPoint.get(point) ?? [],
        (hook) => runOne(hook, payload),
        {
          discard: true,
        },
      ),
  }
}

/** A dispatcher over an explicit hook set, for host assembly and tests. */
export const HookDispatcherLive = (
  hooks: readonly Hook[],
): Layer.Layer<HookDispatcher> =>
  Layer.succeed(HookDispatcher, makeHookDispatcher(hooks))

/**
 * The default: no hooks registered, so every point allows. Keeps a host that
 * has not opted in byte-identical to one built before hooks existed.
 */
export const NoHooksLive: Layer.Layer<HookDispatcher> = HookDispatcherLive([])
