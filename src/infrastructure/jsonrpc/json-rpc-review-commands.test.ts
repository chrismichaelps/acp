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
  it('maps signed review approval evidence to the approval route', () => {
    const command = expectRight(
      parseJsonRpcCommand({
        jsonrpc: '2.0',
        id: 'rpc_review_signed_approve',
        method: 'review.approve',
        params: {
          review_id: 'review_signed',
          met_requirements: ['tests_pass'],
          approval_signature: {
            algorithm: 'ssh-ed25519',
            key_id: 'github:user:human_chris:key1',
            value: 'sig:v1:abc123',
          },
        },
      }),
    )

    expect(command.request).toEqual({
      method: 'POST',
      path: '/v1/reviews/review_signed/approve',
      body: {
        met_requirements: ['tests_pass'],
        approval_signature: {
          algorithm: 'ssh-ed25519',
          key_id: 'github:user:human_chris:key1',
          value: 'sig:v1:abc123',
        },
      },
      label: 'review.approve',
    })
  })

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
