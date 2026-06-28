/** @Acp.Protocol.Version — canonical protocol version negotiation helpers */
import { Schema } from 'effect'

export const ACP_PROTOCOL_VERSION = '0.1' as const

export const SUPPORTED_PROTOCOL_VERSIONS = [ACP_PROTOCOL_VERSION] as const

export type ProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number]

export const ProtocolVersion = Schema.Literal(...SUPPORTED_PROTOCOL_VERSIONS)

export const isSupportedProtocolVersion = (
  version: string,
): version is ProtocolVersion =>
  (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version)
