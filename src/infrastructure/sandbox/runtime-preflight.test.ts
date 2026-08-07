/** @Acp.Infra.Sandbox.RuntimePreflight.Test — a configured runtime must exist */
import { describe, expect, it } from 'vitest'
import { Either, Option } from 'effect'
import { assertRuntimeAvailable } from './runtime-preflight.js'

const check = (
  configured: Option.Option<string>,
  available: readonly string[],
) => assertRuntimeAvailable(configured, available)

describe('sandbox runtime preflight', () => {
  it('passes when no runtime is configured', () => {
    expect(Either.isRight(check(Option.none(), ['runc']))).toBe(true)
  })

  it('passes when the configured runtime is offered', () => {
    expect(Either.isRight(check(Option.some('runsc'), ['runc', 'runsc']))).toBe(
      true,
    )
  })

  // The failure this exists to prevent: an operator asks for gVisor, the daemon
  // does not offer it, and they believe they are hardened when they are not.
  it('fails when the configured runtime is absent', () => {
    const result = check(Option.some('kata'), ['runc'])
    expect(Either.isLeft(result)).toBe(true)
  })

  it('names both the missing runtime and what is available', () => {
    const result = check(Option.some('kata'), ['runc', 'runsc'])
    if (Either.isLeft(result)) {
      expect(result.left).toContain('kata')
      expect(result.left).toContain('runc')
      expect(result.left).toContain('runsc')
    }
  })

  it('fails when the daemon reports no runtimes at all', () => {
    expect(Either.isLeft(check(Option.some('runsc'), []))).toBe(true)
  })

  it('does not accept a partial name match', () => {
    // `runc` must not satisfy a request for `runsc`.
    expect(Either.isLeft(check(Option.some('runsc'), ['runc']))).toBe(true)
  })
})
