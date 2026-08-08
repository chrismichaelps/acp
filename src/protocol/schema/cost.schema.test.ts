/** @Acp.Protocol.Cost.Test — cost schema round-trips */
import { describe, expect, it } from 'vitest'
import { Option, Schema } from 'effect'
import { CostEntry, ResourceUsage } from './cost.schema.js'

describe('cost schema', () => {
  it('round-trips an attested entry with a model', () => {
    const decoded = Schema.decodeUnknownSync(CostEntry)({
      entry_id: 'cost_1',
      workspace_id: 'workspace_1',
      work_id: 'work_1',
      worker_id: 'agent_a',
      usage: {
        model: 'claude-opus-5',
        input_tokens: 1000,
        output_tokens: 200,
        cached_input_tokens: 0,
        cpu_seconds: 0,
        mib_seconds: 0,
      },
      source: 'attested',
      recorded_at: '2026-08-08T10:00:00Z',
    })
    expect(decoded.source).toBe('attested')
    expect(Option.getOrNull(decoded.usage.model)).toBe('claude-opus-5')
  })

  it('round-trips a metered entry with no model', () => {
    const decoded = Schema.decodeUnknownSync(ResourceUsage)({
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
      cpu_seconds: 30,
      mib_seconds: 61440,
    })
    expect(Option.isNone(decoded.model)).toBe(true)
  })

  it('rejects a negative token count', () => {
    expect(() =>
      Schema.decodeUnknownSync(ResourceUsage)({
        input_tokens: -1,
        output_tokens: 0,
        cached_input_tokens: 0,
        cpu_seconds: 0,
        mib_seconds: 0,
      }),
    ).toThrow()
  })
})
