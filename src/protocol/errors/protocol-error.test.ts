/** @Acp.Protocol.Errors.Test — total mapping + no internal leakage */
import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  toProtocolError,
  ValidationError,
  NotFoundError,
  ClaimConflictError,
  LeaseConflictError,
  InvalidStateTransitionError,
  UnauthorizedError,
  UnsupportedCapabilityError,
  StorageError,
} from './protocol-error.js'

describe('toProtocolError', () => {
  it('maps each domain error to the spec §15 code + HTTP status', () => {
    const cases = [
      [new ValidationError({ issues: ['bad'] }), 400, 'invalid_request'],
      [new UnauthorizedError({ reason: 'no token' }), 401, 'unauthorized'],
      [new NotFoundError({ entity: 'work', id: 'w1' }), 404, 'not_found'],
      [
        new ClaimConflictError({ workId: 'work_1', holderWorkerId: 'agent_a' }),
        409,
        'claim_conflict',
      ],
      [
        new LeaseConflictError({
          resourceUri: 'file://x',
          holderWorkerId: 'a',
        }),
        409,
        'lease_conflict',
      ],
      [
        new InvalidStateTransitionError({ from: 'open', to: 'completed' }),
        409,
        'invalid_state_transition',
      ],
      [
        new UnsupportedCapabilityError({ capability: 'can_fly' }),
        400,
        'unsupported_capability',
      ],
      [
        new StorageError({ op: 'put', cause: 'disk full' }),
        500,
        'internal_error',
      ],
    ] as const
    for (const [err, status, code] of cases) {
      const r = toProtocolError(err)
      expect(r.httpStatus).toBe(status)
      expect(r.body.error.code).toBe(code)
    }
  })

  it('collapses StorageError without leaking the internal cause', () => {
    const r = toProtocolError(
      new StorageError({ op: 'put', cause: 'secret path /etc/x' }),
    )
    expect(r.body.error.message).toBe('Internal error.')
    expect(Option.isNone(r.body.error.details)).toBe(true)
  })

  it('surfaces lease conflict holder in details', () => {
    const r = toProtocolError(
      new LeaseConflictError({
        resourceUri: 'file://y',
        holderWorkerId: 'agent_codex',
      }),
    )
    const details = Option.getOrThrow(r.body.error.details)
    expect(details.holder).toBe('agent_codex')
  })

  it('surfaces claim conflict holder in details', () => {
    const r = toProtocolError(
      new ClaimConflictError({
        workId: 'work_123',
        holderWorkerId: 'agent_codex',
      }),
    )
    const details = Option.getOrThrow(r.body.error.details)
    expect(details.work_id).toBe('work_123')
    expect(details.holder).toBe('agent_codex')
  })
})
