/** @Acp.Infra.Rpc.Error — domain errors to native RPC errors */
import { toProtocolError } from '../../protocol/errors/protocol-error.js'
import type { DomainError } from '../../protocol/errors/protocol-error.js'
import type { ProtocolError } from '../../protocol/schema/index.js'

export const toRpcError = (error: DomainError): ProtocolError =>
  toProtocolError(error).body
