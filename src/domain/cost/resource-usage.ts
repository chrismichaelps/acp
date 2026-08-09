/** @Acp.Domain.Cost.ResourceUsage — dimensioned spend and its addition */
import { Option } from 'effect'
import type { ResourceUsage } from '../../protocol/schema/index.js'

export const zeroUsage: ResourceUsage = {
  model: Option.none(),
  input_tokens: 0,
  output_tokens: 0,
  cached_input_tokens: 0,
  cpu_seconds: 0,
  mib_seconds: 0,
}

/**
 * Adds two usages dimension by dimension. The model is deliberately dropped:
 * a sum spans models, and carrying one of the two operands' names forward
 * would make an aggregate look like it were priceable at a single rate.
 */
export const addUsage = (
  left: ResourceUsage,
  right: ResourceUsage,
): ResourceUsage => ({
  model: Option.none(),
  input_tokens: left.input_tokens + right.input_tokens,
  output_tokens: left.output_tokens + right.output_tokens,
  cached_input_tokens: left.cached_input_tokens + right.cached_input_tokens,
  cpu_seconds: left.cpu_seconds + right.cpu_seconds,
  mib_seconds: left.mib_seconds + right.mib_seconds,
})

/** True when any token dimension is non-zero, so pricing needs a model. */
export const hasTokens = (usage: ResourceUsage): boolean =>
  usage.input_tokens > 0 ||
  usage.output_tokens > 0 ||
  usage.cached_input_tokens > 0
