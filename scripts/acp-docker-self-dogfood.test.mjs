import { describe, expect, it, vi } from 'vitest'
import {
  cleanupQuickstartResources,
  classifyQuickstartLeaseRace,
  isMissingDockerResource,
  main,
  proveComposeProjectIsolation,
  resolveQuickstartImage,
  runRepositoryPreflights,
  runWithQuickstartCleanup,
  verifyQuickstartReplayTail,
  verifyComposeProjectIsolation,
  verifyGeneratedContainerNames,
} from './acp-docker-self-dogfood.mjs'

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

  it('accepts distinct Compose projects without fixed container names', () => {
    expect(() =>
      verifyComposeProjectIsolation(
        { name: 'acp-isolation-a', services: { acp: {} } },
        { name: 'acp-isolation-b', services: { acp: {} } },
      ),
    ).not.toThrow()
  })

  it('rejects a daemon-global Compose container name', () => {
    expect(() =>
      verifyComposeProjectIsolation(
        {
          name: 'acp-isolation-a',
          services: { acp: { container_name: 'acp-host' } },
        },
        { name: 'acp-isolation-b', services: { acp: {} } },
      ),
    ).toThrow('Compose service acp must not fix container_name')
  })

  it('creates, inspects, and cleans two project namespaces', async () => {
    const run = vi.fn((args) => {
      const project = args[args.indexOf('--project-name') + 1]
      if (args.includes('config'))
        return Promise.resolve(
          JSON.stringify({ name: project, services: { acp: {} } }),
        )
      if (args.includes('ps'))
        return Promise.resolve(JSON.stringify({ Name: `${project}-acp-1` }))
      return Promise.resolve('')
    })

    await expect(
      proveComposeProjectIsolation({
        run,
        projectNames: ['acp-isolation-a', 'acp-isolation-b'],
      }),
    ).resolves.toEqual([['acp-isolation-a-acp-1'], ['acp-isolation-b-acp-1']])

    const commands = run.mock.calls.map(([args]) => args)
    expect(commands.filter((args) => args.includes('create'))).toHaveLength(2)
    expect(commands.filter((args) => args.includes('ps'))).toHaveLength(2)
    expect(commands.filter((args) => args.includes('down'))).toHaveLength(2)
    expect(
      commands
        .filter((args) => args.includes('down'))
        .every(
          (args) =>
            args.includes('--volumes') && args.includes('--remove-orphans'),
        ),
    ).toBe(true)
  })

  it('cleans both projects when create fails', async () => {
    const run = vi.fn((args) => {
      const project = args[args.indexOf('--project-name') + 1]
      if (args.includes('config'))
        return Promise.resolve(
          JSON.stringify({ name: project, services: { acp: {} } }),
        )
      if (args.includes('create') && project.endsWith('-b'))
        return Promise.reject(new Error('create failed'))
      return Promise.resolve('')
    })

    await expect(
      proveComposeProjectIsolation({
        run,
        projectNames: ['acp-isolation-a', 'acp-isolation-b'],
      }),
    ).rejects.toThrow('create failed')
    expect(
      run.mock.calls.filter(([args]) => args.includes('down')),
    ).toHaveLength(2)
  })

  it('cleans both projects when generated names overlap', async () => {
    const run = vi.fn((args) => {
      const project = args[args.indexOf('--project-name') + 1]
      if (args.includes('config'))
        return Promise.resolve(
          JSON.stringify({ name: project, services: { acp: {} } }),
        )
      if (args.includes('ps'))
        return Promise.resolve(JSON.stringify({ Name: 'acp-host' }))
      return Promise.resolve('')
    })

    await expect(
      proveComposeProjectIsolation({
        run,
        projectNames: ['acp-isolation-a', 'acp-isolation-b'],
      }),
    ).rejects.toThrow('overlapping container names: acp-host')
    expect(
      run.mock.calls.filter(([args]) => args.includes('down')),
    ).toHaveLength(2)
  })

  it('rejects empty daemon container-name evidence', () => {
    expect(() => verifyGeneratedContainerNames([], ['acp-b-acp-1'])).toThrow(
      'first Compose project created no containers',
    )
  })

  it('requires one HTTP winner and one typed lease conflict', () => {
    const winner = {
      agent: { worker: 'agent_a' },
      response: { status: 201, body: { id: 'lease_1', state: 'active' } },
    }
    const conflict = {
      agent: { worker: 'agent_b' },
      response: {
        status: 409,
        body: { error: { code: 'lease_conflict' } },
      },
    }

    expect(classifyQuickstartLeaseRace([conflict, winner])).toEqual({
      winner,
      conflict,
    })
    expect(() => classifyQuickstartLeaseRace([winner, winner])).toThrow(
      'exactly one HTTP 201 winner',
    )
    expect(() =>
      classifyQuickstartLeaseRace([
        winner,
        { ...conflict, response: { ...conflict.response, status: 400 } },
      ]),
    ).toThrow('exactly one HTTP 409 lease_conflict loser')
  })

  it('accepts only the strict post-cursor checkpoint and handoff tail', () => {
    expect(
      verifyQuickstartReplayTail(7, [
        { seq: 8, type: 'checkpoint.created' },
        { seq: 9, type: 'memory.created' },
      ]),
    ).toEqual([8, 9])

    expect(() =>
      verifyQuickstartReplayTail(0, [
        { seq: 1, type: 'checkpoint.created' },
        { seq: 2, type: 'memory.created' },
      ]),
    ).toThrow('positive integer')
    expect(() =>
      verifyQuickstartReplayTail(7, [
        { seq: 8, type: 'memory.created' },
        { seq: 9, type: 'checkpoint.created' },
      ]),
    ).toThrow('expected checkpoint and handoff events')
    expect(() =>
      verifyQuickstartReplayTail(7, [
        { seq: 9, type: 'checkpoint.created' },
        { seq: 8, type: 'memory.created' },
      ]),
    ).toThrow('strictly monotonic')
  })

  it('accepts only case-varying Docker missing-resource cleanup errors', () => {
    expect(
      isMissingDockerResource(
        'Error response from daemon: No such container: quickstart',
      ),
    ).toBe(true)
    expect(
      isMissingDockerResource(
        'Error response from daemon: get quickstart-data: no such volume',
      ),
    ).toBe(true)
    expect(
      isMissingDockerResource(
        'Error response from daemon: volume is in use by container',
      ),
    ).toBe(false)
    expect(
      isMissingDockerResource(
        'Error response from daemon: No such image: acp:quickstart-run',
      ),
    ).toBe(true)
  })

  it('uses an owned run-scoped image only for standalone quickstarts', () => {
    expect(
      resolveQuickstartImage({
        skipBuild: false,
        aggregateImage: 'acp:docker-self-dogfood',
        runId: 'run-123',
      }),
    ).toBe('acp:quickstart-run-123')
    expect(
      resolveQuickstartImage({
        skipBuild: true,
        aggregateImage: 'acp:docker-self-dogfood',
        runId: 'run-123',
      }),
    ).toBe('acp:docker-self-dogfood')
  })

  it('attempts every owned resource cleanup and reports all failures', async () => {
    const attempted = []
    const remove = vi.fn((args) => {
      attempted.push(args)
      return Promise.reject(new Error(`cannot remove ${args[0]}`))
    })

    await expect(
      cleanupQuickstartResources({
        containerName: 'quickstart',
        volumeName: 'quickstart-data',
        imageName: 'acp:quickstart-run',
        ownsImage: true,
        remove,
      }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining([
        expect.objectContaining({ message: 'cannot remove rm' }),
        expect.objectContaining({ message: 'cannot remove volume' }),
        expect.objectContaining({ message: 'cannot remove image' }),
      ]),
    })
    expect(attempted).toEqual([
      ['rm', '-f', 'quickstart'],
      ['volume', 'rm', 'quickstart-data'],
      ['image', 'rm', 'acp:quickstart-run'],
    ])
  })

  it('waits for container teardown before dependent resource cleanup', async () => {
    const attempted = []
    let finishContainerRemoval
    const remove = vi.fn((args) => {
      attempted.push(args)
      if (args[0] !== 'rm') return Promise.resolve()
      return new Promise((resolvePromise) => {
        finishContainerRemoval = resolvePromise
      })
    })

    const cleanup = cleanupQuickstartResources({
      containerName: 'quickstart',
      volumeName: 'quickstart-data',
      imageName: 'acp:quickstart-run',
      ownsImage: true,
      remove,
    })
    await Promise.resolve()
    expect(attempted).toEqual([['rm', '-f', 'quickstart']])

    finishContainerRemoval()
    await cleanup
    expect(attempted).toEqual([
      ['rm', '-f', 'quickstart'],
      ['volume', 'rm', 'quickstart-data'],
      ['image', 'rm', 'acp:quickstart-run'],
    ])
  })

  it('preserves the aggregate image during skip-build cleanup', async () => {
    const remove = vi.fn(() => Promise.resolve())

    await cleanupQuickstartResources({
      containerName: 'quickstart',
      volumeName: 'quickstart-data',
      imageName: 'acp:docker-self-dogfood',
      ownsImage: false,
      remove,
    })

    expect(remove.mock.calls.map(([args]) => args)).toEqual([
      ['rm', '-f', 'quickstart'],
      ['volume', 'rm', 'quickstart-data'],
    ])
  })

  it('publishes success only after cleanup succeeds', async () => {
    const order = []
    await expect(
      runWithQuickstartCleanup({
        operation: () => {
          order.push('operation')
          return Promise.resolve({ ok: true })
        },
        cleanup: () => {
          order.push('cleanup')
          return Promise.resolve()
        },
        publish: () => order.push('publish'),
      }),
    ).resolves.toEqual({ ok: true })
    expect(order).toEqual(['operation', 'cleanup', 'publish'])
  })

  it('does not publish a successful operation when cleanup fails', async () => {
    const publish = vi.fn()

    await expect(
      runWithQuickstartCleanup({
        operation: () => Promise.resolve({ ok: true }),
        cleanup: () => Promise.reject(new Error('cleanup failed')),
        publish,
      }),
    ).rejects.toThrow('cleanup failed')
    expect(publish).not.toHaveBeenCalled()
  })

  it('withholds success and preserves operation plus cleanup failures', async () => {
    const publish = vi.fn()
    const operationError = new Error('operation failed')
    const cleanupError = new Error('cleanup failed')

    await expect(
      runWithQuickstartCleanup({
        operation: () => Promise.reject(operationError),
        cleanup: () => Promise.reject(cleanupError),
        publish,
      }),
    ).rejects.toMatchObject({ errors: [operationError, cleanupError] })
    expect(publish).not.toHaveBeenCalled()
  })
})
