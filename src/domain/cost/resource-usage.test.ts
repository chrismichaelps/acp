/** @Acp.Domain.Cost.ResourceUsage.Test — dimensioned addition */
import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import type { ResourceUsage } from '../../protocol/schema/index.js'
import { addUsage, hasTokens, zeroUsage } from './resource-usage.js'

const usage = (over: Partial<ResourceUsage>): ResourceUsage => ({
  ...zeroUsage,
  ...over,
})

describe('addUsage', () => {
  it('adds each dimension independently', () => {
    const sum = addUsage(
      usage({ input_tokens: 10, cpu_seconds: 2 }),
      usage({ input_tokens: 5, mib_seconds: 100 }),
    )
    expect(sum.input_tokens).toBe(15)
    expect(sum.cpu_seconds).toBe(2)
    expect(sum.mib_seconds).toBe(100)
  })

  it('drops the model, because a sum spans models', () => {
    const sum = addUsage(
      usage({ model: Option.some('claude-opus-5'), input_tokens: 1 }),
      usage({ model: Option.some('claude-opus-5'), input_tokens: 1 }),
    )
    expect(Option.isNone(sum.model)).toBe(true)
  })

  it('treats zeroUsage as the identity', () => {
    const one = usage({ output_tokens: 7, model: Option.some('m') })
    expect(addUsage(one, zeroUsage).output_tokens).toBe(7)
  })
})

describe('hasTokens', () => {
  it('is false for pure compute', () => {
    expect(hasTokens(usage({ cpu_seconds: 10 }))).toBe(false)
  })

  it('is true when any token dimension is non-zero', () => {
    expect(hasTokens(usage({ cached_input_tokens: 1 }))).toBe(true)
  })
})
