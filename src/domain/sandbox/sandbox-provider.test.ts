/** @Acp.Domain.Sandbox.Provider.Test — the default adapter is inert */
import { describe, expect, it } from 'vitest'
import { Effect, Schema } from 'effect'
import { WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import { NoSandboxLive, SandboxProvider } from './sandbox-provider.js'

const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_1')

const run = <A, E>(program: Effect.Effect<A, E, SandboxProvider>): A =>
  Effect.runSync(Effect.provide(program, NoSandboxLive))

describe('the none sandbox provider', () => {
  it('reports no sandbox rather than failing', () => {
    const handle = run(
      Effect.flatMap(SandboxProvider, (provider) =>
        provider.start({
          workspaceId,
          workId,
          root: { source: '/srv/w', target: '/srv/w', writable: false },
          writable: [],
          networkAllow: [],
          secrets: {},
        }),
      ),
    )
    expect(handle).toEqual({ workId, status: 'absent' })
  })

  it('inspects an unknown work unit without erroring', () => {
    const handle = run(
      Effect.flatMap(SandboxProvider, (provider) => provider.inspect(workId)),
    )
    expect(handle.status).toBe('absent')
  })

  it('stops a nonexistent sandbox as a no-op', () => {
    expect(() => {
      run(Effect.flatMap(SandboxProvider, (provider) => provider.stop(workId)))
    }).not.toThrow()
  })
})
