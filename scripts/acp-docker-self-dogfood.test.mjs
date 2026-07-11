import { describe, expect, it, vi } from 'vitest'
import { main, runRepositoryPreflights } from './acp-docker-self-dogfood.mjs'

describe('complete Docker self-dogfood orchestration', () => {
  it('runs repository policy guards through Node in order', async () => {
    const calls = []
    await runRepositoryPreflights((command, args) => {
      calls.push({ command, args })
      return Promise.resolve()
    })

    expect(calls).toEqual([
      {
        command: 'node',
        args: ['scripts/check-edge-runtime-pins.mjs'],
      },
      {
        command: 'node',
        args: ['scripts/check-agent-doc-permissions.mjs'],
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
