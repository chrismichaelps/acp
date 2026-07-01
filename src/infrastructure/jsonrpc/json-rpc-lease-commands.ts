/** @Acp.Infra.JsonRpc.LeaseCommands — lease lifecycle method mappings */
import { Either, Option, Schema } from 'effect'
import { RenewLeasePayload } from '../http/index.js'
import {
  LeaseId,
  RequestLeasePayload,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import {
  decodeParams,
  encodeSegment,
  validatedBody,
} from './json-rpc-command-support.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
  JsonRpcMethod,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'

export const leaseMethodLabels = [
  'lease.request',
  'lease.list',
  'lease.renew',
  'lease.release',
  'lease.revoke',
] as const

const LeaseParams = Schema.Struct({ lease_id: LeaseId })
const LeaseListParams = Schema.Struct({ workspace_id: WorkspaceId })
const RenewParams = Schema.Struct({
  lease_id: LeaseId,
  ttl_seconds: RenewLeasePayload.fields.ttl_seconds,
})

const lifecycleCommand = (
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
  method: JsonRpcMethod,
  leaseId: LeaseId,
  action: 'release' | 'renew' | 'revoke',
  body?: Record<string, unknown>,
): JsonRpcCommand => ({
  id,
  expects_response: expectsResponse,
  request: {
    method: 'POST',
    path: `/v1/leases/${encodeSegment(leaseId)}/${action}`,
    body,
    label: method,
  },
})

export const commandForLease = (
  method: JsonRpcMethod,
  paramsValue: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
): Option.Option<Either.Either<JsonRpcCommand, JsonRpcRequestError>> => {
  if (method === 'lease.request') {
    return Option.some(
      Either.map(
        validatedBody(RequestLeasePayload, paramsValue, id),
        (body) => ({
          id,
          expects_response: expectsResponse,
          request: { method: 'POST', path: '/v1/leases', body, label: method },
        }),
      ),
    )
  }

  if (method === 'lease.list') {
    return Option.some(
      Either.map(decodeParams(LeaseListParams, paramsValue, id), (params) => ({
        id,
        expects_response: expectsResponse,
        request: {
          method: 'GET',
          path: `/v1/leases?workspace_id=${encodeURIComponent(params.workspace_id)}`,
          label: method,
        },
      })),
    )
  }

  if (method === 'lease.renew') {
    return Option.some(
      Either.map(decodeParams(RenewParams, paramsValue, id), (params) =>
        lifecycleCommand(
          id,
          expectsResponse,
          method,
          params.lease_id,
          'renew',
          Option.match(params.ttl_seconds, {
            onNone: () => ({}),
            onSome: (ttl_seconds) => ({ ttl_seconds }),
          }),
        ),
      ),
    )
  }

  if (method === 'lease.release' || method === 'lease.revoke') {
    const action = method === 'lease.release' ? 'release' : 'revoke'
    return Option.some(
      Either.map(decodeParams(LeaseParams, paramsValue, id), (params) =>
        lifecycleCommand(id, expectsResponse, method, params.lease_id, action),
      ),
    )
  }

  return Option.none()
}
