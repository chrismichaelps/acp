/** @Acp.Domain.Identity.Service — provenance checks beside session authorization */
import { Context, Effect, Either, Layer, Option } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import { WorkerService } from '../workers/index.js'
import {
  ForbiddenError,
  NotFoundError,
} from '../../protocol/errors/protocol-error.js'
import type { StorageError } from '../../protocol/errors/protocol-error.js'
import type { WorkerId } from '../../protocol/schema/index.js'
import { verifyWorkerAssertion } from './worker-assertion.js'
import type { AssertionAction, WorkerAssertion } from './worker-assertion.js'

/** Bounds how long a captured assertion stays replayable against its own target. */
const MAX_SKEW_SECONDS = 60

export interface VerifyIdentityInput {
  readonly workerId: WorkerId
  readonly action: AssertionAction
  readonly targetId: string
  readonly assertion: Option.Option<WorkerAssertion>
  readonly now: string
  /**
   * Whether absent proof is a refusal. Defaults to the configured enforcement.
   *
   * Set `false` for actions whose transports cannot yet carry an assertion:
   * requiring proof a caller has no way to supply would refuse the action
   * outright, so those are verified-if-supplied until the wire catches up.
   */
  readonly required?: boolean
}

export interface IdentityOutcome {
  /** Whether this action carried a signature that verified. */
  readonly signed: boolean
}

export type WorkerIdentityError = NotFoundError | ForbiddenError | StorageError

export interface WorkerIdentityServiceApi {
  readonly verify: (
    input: VerifyIdentityInput,
  ) => Effect.Effect<IdentityOutcome, WorkerIdentityError>
}

export class WorkerIdentityService extends Context.Tag('WorkerIdentityService')<
  WorkerIdentityService,
  WorkerIdentityServiceApi
>() {}

const make = Effect.gen(function* () {
  const config = yield* AppConfigTag
  const workers = yield* WorkerService

  const verify: WorkerIdentityServiceApi['verify'] = (input) =>
    Effect.gen(function* () {
      // Nothing to check and nothing required: return without reading the
      // worker at all. Looking it up here would silently make registration a
      // precondition of every claim, which is not what provenance is for.
      const required = input.required ?? config.requireWorkerSignatures
      if (Option.isNone(input.assertion) && !required) {
        return { signed: false }
      }

      const stored = yield* workers.get(input.workerId)
      const worker = yield* Option.match(stored, {
        onNone: () =>
          Effect.fail(
            new NotFoundError({ entity: 'worker', id: input.workerId }),
          ),
        onSome: Effect.succeed,
      })

      if (Option.isNone(input.assertion)) {
        return yield* Effect.fail(
          new ForbiddenError({
            reason: `worker ${input.workerId} must sign ${input.action}`,
          }),
        )
      }

      const assertion = input.assertion.value

      // An assertion is a claim *by this worker about this action*. Checking
      // these before the signature keeps a valid signature from another context
      // from being accepted here.
      if (assertion.workerId !== input.workerId) {
        return yield* Effect.fail(
          new ForbiddenError({
            reason: 'assertion names a different worker than the acting one',
          }),
        )
      }
      if (assertion.action !== input.action) {
        return yield* Effect.fail(
          new ForbiddenError({ reason: 'assertion names a different action' }),
        )
      }
      if (assertion.targetId !== input.targetId) {
        return yield* Effect.fail(
          new ForbiddenError({ reason: 'assertion names a different target' }),
        )
      }

      const publicKey = yield* Option.match(worker.public_key, {
        onNone: () =>
          Effect.fail(
            new ForbiddenError({
              reason: `worker ${input.workerId} registered no public key`,
            }),
          ),
        onSome: Effect.succeed,
      })

      const checked = verifyWorkerAssertion({
        publicKey,
        assertion,
        now: input.now,
        maxSkewSeconds: MAX_SKEW_SECONDS,
      })

      // A failed proof is rejected in both modes. Enforcement decides whether
      // proof is *required*, not whether a *failed* proof is acceptable —
      // accepting one would make the recorded `signed` flag meaningless.
      return Either.isLeft(checked)
        ? yield* Effect.fail(new ForbiddenError({ reason: checked.left }))
        : { signed: true }
    })

  return { verify } satisfies WorkerIdentityServiceApi
})

export const WorkerIdentityServiceLive: Layer.Layer<
  WorkerIdentityService,
  never,
  AppConfigTag | WorkerService
> = Layer.effect(WorkerIdentityService, make)
