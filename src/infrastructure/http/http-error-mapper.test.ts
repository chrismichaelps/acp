/** @Acp.Infra.Http.ErrorMapper.Test — JSON protocol error responses */
import { describe, expect, it } from 'vitest'
import {
  InvalidStateTransitionError,
  NotFoundError,
  StorageError,
} from '../../protocol/errors/protocol-error.js'
import { toHttpErrorResponse } from './index.js'

describe('toHttpErrorResponse', () => {
  it('maps domain errors to HTTP status codes', () => {
    expect(
      toHttpErrorResponse(new NotFoundError({ entity: 'work', id: 'w1' }))
        .status,
    ).toBe(404)
    expect(
      toHttpErrorResponse(
        new InvalidStateTransitionError({
          from: 'open',
          to: 'completed',
        }),
      ).status,
    ).toBe(409)
  })

  it('keeps StorageError causes out of the JSON body', () => {
    const response = toHttpErrorResponse(
      new StorageError({ op: 'put', cause: 'secret path /Users/chris' }),
    )

    expect(response.status).toBe(500)
    expect(JSON.stringify(response.body)).not.toContain('/Users/chris')
  })
})
