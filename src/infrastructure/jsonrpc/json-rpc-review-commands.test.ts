/** @Acp.Infra.JsonRpc.ReviewCommands.Test — review method mapping */
import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { parseJsonRpcCommand } from './json-rpc.js'
import type { JsonRpcCommand } from './json-rpc.js'

const expectRight = <E>(
  value: Either.Either<JsonRpcCommand, E>,
): JsonRpcCommand => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

describe('JSON-RPC review commands', () => {
  it('maps review.cancel to the dedicated cancellation route', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_review_cancel',
        method: 'review.cancel',
        params: { review_id: 'review_main' },
      }),
    )

    expect(command.request).toEqual({
      method: 'POST',
      path: '/v1/reviews/review_main/cancel',
      label: 'review.cancel',
    })
  })
})
