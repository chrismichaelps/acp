/** @Acp.Infra.Rpc.TestSupport — shared native RPC test runtime */
import { Headers } from '@effect/platform'
import { Layer, Schema } from 'effect'
import { AppLive } from '../../app/index.js'
import { IdClockLive } from '../../app/server/identity.js'
import {
  InitializeSessionPayload,
  type InitializeSessionPayload as InitializeSessionPayloadType,
} from '../http/acp-http-api.js'
import type { WorkspaceId } from '../../protocol/schema/index.js'
import { AcpRpcSessionWorkerWorkspaceHandlersLive } from './acp-rpc-handlers.js'

export const Runtime = AcpRpcSessionWorkerWorkspaceHandlersLive.pipe(
  Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
)

export const decodeInitialize = (
  permissions: InitializeSessionPayloadType['permissions'],
  workspaceIds?: readonly WorkspaceId[],
) =>
  Schema.decodeUnknown(InitializeSessionPayload)({
    worker: {
      id: 'agent_rpc',
      name: 'RPC Agent',
      kind: 'agent',
    },
    capabilities: {
      can_edit_files: true,
      can_run_commands: false,
      can_create_prs: false,
      can_review: false,
      supports_checkpoints: false,
      supports_leases: false,
    },
    permissions,
    ...(workspaceIds === undefined ? {} : { workspace_ids: workspaceIds }),
  })

export const bearer = (sessionId: string) =>
  Headers.fromInput({ authorization: `Bearer ${sessionId}` })

export const decodePayload = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  input: unknown,
) => Schema.decodeUnknown(schema)(input)

export const rpcOptions = (headers = Headers.empty) =>
  // Runtime accessHandler forwards this options object; 0.75.1's d.ts narrows it to Headers.
  ({ clientId: 0, headers }) as unknown as Headers.Headers
