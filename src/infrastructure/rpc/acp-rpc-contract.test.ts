/** @Acp.Infra.Rpc.Contract.Test — native RPC contract registry */
import { Context, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { AcpRpcGroup, acpRpcTags, AcpRpcs } from './acp-rpc-contract.js'
import {
  AcpRpcAuthMiddleware,
  AcpRpcRequiredScope,
} from './rpc-auth-middleware.js'
import { AcpRpcTelemetryMiddleware } from './rpc-telemetry-middleware.js'

const requiredScope = (rpc: { annotations: Context.Context<never> }) =>
  Option.getOrUndefined(Context.getOption(rpc.annotations, AcpRpcRequiredScope))

const hasAuthMiddleware = (rpc: {
  middlewares: ReadonlySet<unknown>
}): boolean => rpc.middlewares.has(AcpRpcAuthMiddleware)

const hasTelemetryMiddleware = (rpc: {
  middlewares: ReadonlySet<unknown>
}): boolean => rpc.middlewares.has(AcpRpcTelemetryMiddleware)

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
      'events.subscribe',
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

  it('carries scope metadata for native RPC auth middleware', () => {
    expect(requiredScope(AcpRpcs.sessionInitialize)).toBeUndefined()
    expect(requiredScope(AcpRpcs.workerList)).toBe('worker:read')
    expect(requiredScope(AcpRpcs.workspaceCreate)).toBe('workspace:write')
    expect(requiredScope(AcpRpcs.workPublishEvent)).toBe('work:publish_event')
    expect(requiredScope(AcpRpcs.leaseRevoke)).toBe('lease:revoke')
    expect(requiredScope(AcpRpcs.artifactUpdate)).toBe('artifact:update')
    expect(requiredScope(AcpRpcs.checkpointCreate)).toBe('checkpoint:create')
    expect(requiredScope(AcpRpcs.reviewRequestChanges)).toBe(
      'review:request_changes',
    )
    expect(requiredScope(AcpRpcs.memoryCreate)).toBe('memory:create')
    expect(requiredScope(AcpRpcs.eventList)).toBe('event:read')
    expect(requiredScope(AcpRpcs.eventSubscribe)).toBe('event:read')
    expect(hasAuthMiddleware(AcpRpcs.workspaceCreate)).toBe(true)
  })

  it('attaches telemetry middleware to every native RPC operation', () => {
    for (const rpc of AcpRpcGroup.requests.values()) {
      expect(hasTelemetryMiddleware(rpc)).toBe(true)
    }
  })
})
