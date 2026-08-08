/** @Acp.Domain.WorkUnits.ServiceTypes — public inputs and error surfaces */
import type {
  BudgetExhaustedError,
  ClaimConflictError,
  DepthLimitExceededError,
  ForbiddenError,
  HookDeniedError,
  IncompleteChildrenError,
  InvalidStateTransitionError,
  NotFoundError,
  StorageError,
  ValidationError,
} from '../../protocol/errors/protocol-error.js'
import type {
  CreateWorkPayload,
  Timestamp,
  WorkId,
  WorkerId,
} from '../../protocol/schema/index.js'
import type { BlockedCancellation } from './work-unit-spawn-graph.js'

export interface CreateWorkInput {
  readonly id: WorkId
  readonly payload: CreateWorkPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export type WorkUnitCreateError =
  | NotFoundError
  | ValidationError
  | InvalidStateTransitionError
  | DepthLimitExceededError
  | StorageError

export type WorkUnitClaimError =
  | NotFoundError
  | ClaimConflictError
  | InvalidStateTransitionError
  | HookDeniedError
  | ForbiddenError
  | BudgetExhaustedError
  | StorageError

export type WorkUnitTransitionError =
  | NotFoundError
  | InvalidStateTransitionError
  | IncompleteChildrenError
  | HookDeniedError
  | BudgetExhaustedError
  | StorageError

export interface CancelSubtreeResult {
  /** Cancelled by this call, deepest-first. Empty on a re-run. */
  readonly cancelled: readonly WorkId[]
  /** Non-terminal units whose state admits no `cancelled` edge. */
  readonly blocked: readonly BlockedCancellation[]
}
