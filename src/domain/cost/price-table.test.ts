/** @Acp.Domain.Cost.PriceTable.Test — usage priced by workspace policy */
import { describe, expect, it } from 'vitest'
import { Option, Schema } from 'effect'
import { Timestamp, WorkspaceId } from '../../protocol/schema/index.js'
import type { PriceTable, ResourceUsage } from '../../protocol/schema/index.js'
import { priceOf } from './price-table.js'
import { zeroUsage } from './resource-usage.js'

const table: PriceTable = {
  workspace_id: Schema.decodeUnknownSync(WorkspaceId)('workspace_1'),
  models: {
    'claude-opus-5': {
      input_micro_usd_per_token: 15,
      output_micro_usd_per_token: 75,
      cached_input_micro_usd_per_token: 2,
    },
  },
  cpu_micro_usd_per_second: 10,
  mib_micro_usd_per_second: 1,
  updated_at: Schema.decodeUnknownSync(Timestamp)('2026-08-08T10:00:00Z'),
}

const usage = (over: Partial<ResourceUsage>): ResourceUsage => ({
  ...zeroUsage,
  ...over,
})

describe('priceOf', () => {
  it('prices tokens at the named model rate', () => {
    const result = priceOf(
      usage({
        model: Option.some('claude-opus-5'),
        input_tokens: 100,
        output_tokens: 10,
        cached_input_tokens: 50,
      }),
      table,
    )
    // 100*15 + 10*75 + 50*2 = 1500 + 750 + 100
    expect(result).toEqual({ _tag: 'Priced', micro_usd: 2350 })
  })

  it('prices compute with no model named', () => {
    const result = priceOf(usage({ cpu_seconds: 3, mib_seconds: 20 }), table)
    expect(result).toEqual({ _tag: 'Priced', micro_usd: 50 })
  })

  it('adds compute to token cost in a single entry', () => {
    const result = priceOf(
      usage({
        model: Option.some('claude-opus-5'),
        input_tokens: 1,
        cpu_seconds: 1,
      }),
      table,
    )
    expect(result).toEqual({ _tag: 'Priced', micro_usd: 25 })
  })

  it('refuses an unknown model', () => {
    const result = priceOf(
      usage({ model: Option.some('mystery-model'), input_tokens: 1 }),
      table,
    )
    expect(result).toEqual({ _tag: 'Unpriced', model: 'mystery-model' })
  })

  it('refuses tokens reported with no model at all', () => {
    // Otherwise a budget is escaped by omitting the model field entirely.
    const result = priceOf(usage({ input_tokens: 1_000_000 }), table)
    expect(result).toEqual({ _tag: 'Unpriced', model: '<unnamed>' })
  })

  it('refuses a model name that only resolves through the prototype', () => {
    const result = priceOf(
      usage({ model: Option.some('constructor'), input_tokens: 1 }),
      table,
    )
    expect(result).toEqual({ _tag: 'Unpriced', model: 'constructor' })
  })

  it('prices an empty usage as zero', () => {
    expect(priceOf(zeroUsage, table)).toEqual({ _tag: 'Priced', micro_usd: 0 })
  })
})
