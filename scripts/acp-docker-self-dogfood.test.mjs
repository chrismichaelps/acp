import { describe, expect, it, vi } from 'vitest'
import { main, runEdgeRuntimePreflight } from './acp-docker-self-dogfood.mjs'

describe('complete Docker self-dogfood orchestration', () => {
  it('runs the edge runtime policy guard through Node', async () => {
    const calls = []
    await runEdgeRuntimePreflight((command, args) => {
      calls.push({ command, args })
      return Promise.resolve()
    })

    expect(calls).toEqual([
      {
        command: 'node',
        args: ['scripts/check-edge-runtime-pins.mjs'],
      },
    ])
  })

  it('runs the production scenario only after preflight succeeds', async () => {
    const order = []
    await main({
      preflight: () => {
        order.push('preflight')
        return Promise.resolve()
      },
      scenario: () => {
        order.push('scenario')
        return Promise.resolve()
      },
    })

    expect(order).toEqual(['preflight', 'scenario'])
  })

  it('aborts before build orchestration when preflight fails', async () => {
    const scenario = vi.fn(() => Promise.resolve())

    await expect(
      main({
        preflight: () => Promise.reject(new Error('edge policy failed')),
        scenario,
      }),
    ).rejects.toThrow('edge policy failed')
    expect(scenario).not.toHaveBeenCalled()
  })
})
