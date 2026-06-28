/** @Acp.Protocol.Version.Test — supported protocol version contract */
import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import {
  ACP_PROTOCOL_VERSION,
  ProtocolVersion,
  SUPPORTED_PROTOCOL_VERSIONS,
  isSupportedProtocolVersion,
} from './version.js'

describe('protocol version contract', () => {
  it('declares the current ACP protocol version as the only supported version', () => {
    expect(ACP_PROTOCOL_VERSION).toBe('0.1')
    expect(SUPPORTED_PROTOCOL_VERSIONS).toEqual(['0.1'])
    expect(isSupportedProtocolVersion('0.1')).toBe(true)
    expect(isSupportedProtocolVersion('0.2')).toBe(false)
  })

  it('decodes only supported protocol versions', () => {
    expect(Schema.decodeUnknownSync(ProtocolVersion)('0.1')).toBe('0.1')
    expect(() => Schema.decodeUnknownSync(ProtocolVersion)('0.2')).toThrow()
  })
})
