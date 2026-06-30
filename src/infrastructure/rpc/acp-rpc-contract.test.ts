/** @Acp.Infra.Rpc.Contract.Test — native RPC contract registry */
import { describe, expect, it } from 'vitest'
import { AcpRpcGroup, acpRpcTags, AcpRpcs } from './acp-rpc-contract.js'

describe('AcpRpcGroup', () => {
  it('exposes the current non-streaming ACP operation set', () => {
    expect(acpRpcTags).toEqual([
      'artifact.content',
      'artifact.create',
      'artifact.delete',
      'artifact.list_for_work',
      'artifact.list_for_workspace',
      'artifact.update',
      'checkpoint.create',
      'checkpoint.latest_for_work',
      'checkpoint.list_for_work',
      'checkpoint.list_for_workspace',
      'events.list',
      'lease.release',
      'lease.renew',
      'lease.request',
      'lease.revoke',
      'memory.create',
      'memory.list',
      'review.approve',
      'review.cancel',
      'review.list_for_work',
      'review.list_for_workspace',
      'review.reject',
      'review.request',
      'review.request_changes',
      'session.initialize',
      'work.claim',
      'work.create',
      'work.get',
      'work.list_for_workspace',
      'work.publish_event',
      'work.update_state',
      'worker.get',
      'worker.list',
      'workspace.archive',
      'workspace.create',
      'workspace.list',
      'workspace.update',
    ])
  })

  it('keeps operation constants and group registry aligned', () => {
    expect(AcpRpcGroup.requests.get(AcpRpcs.workCreate._tag)).toBe(
      AcpRpcs.workCreate,
    )
    expect(AcpRpcGroup.requests.get(AcpRpcs.memoryList._tag)).toBe(
      AcpRpcs.memoryList,
    )
    expect(AcpRpcGroup.requests.get(AcpRpcs.eventList._tag)).toBe(
      AcpRpcs.eventList,
    )
  })
})
