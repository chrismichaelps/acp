/** @Acp.Infra.Sandbox.DockerRequest.Test — container spec is safe by construction */
import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import type { SandboxSpec } from '../../domain/sandbox/index.js'
import {
  containerNameFor,
  toCreateContainerRequest,
  toSandboxStatus,
} from './docker-request.js'

const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_1')

const spec = (over: Partial<SandboxSpec> = {}): SandboxSpec => ({
  workspaceId,
  workId,
  root: { source: '/srv/w', target: '/srv/w', writable: false },
  writable: [],
  networkAllow: [],
  secrets: {},
  ...over,
})

const request = (over: Partial<SandboxSpec> = {}) =>
  toCreateContainerRequest(spec(over), 'acp/agent:1')

describe('docker create request — filesystem', () => {
  it('mounts the workspace root read-only', () => {
    const mounts = request().HostConfig.Mounts
    expect(mounts).toContainEqual({
      Type: 'bind',
      Source: '/srv/w',
      Target: '/srv/w',
      ReadOnly: true,
    })
  })

  it('mounts a leased path read-write', () => {
    const mounts = request({
      writable: [
        { source: '/srv/w/a.ts', target: '/srv/w/a.ts', writable: true },
      ],
    }).HostConfig.Mounts
    expect(mounts).toContainEqual({
      Type: 'bind',
      Source: '/srv/w/a.ts',
      Target: '/srv/w/a.ts',
      ReadOnly: false,
    })
  })

  it('orders the read-only root before the writable overlays', () => {
    // Docker applies bind mounts in order; the root must land first or it would
    // shadow the per-lease writable mounts layered on top of it.
    const mounts = request({
      writable: [
        { source: '/srv/w/a.ts', target: '/srv/w/a.ts', writable: true },
      ],
    }).HostConfig.Mounts
    expect(mounts[0]?.Target).toBe('/srv/w')
  })
})

describe('docker create request — network', () => {
  it('denies all egress when no hosts are allowed', () => {
    expect(request().HostConfig.NetworkMode).toBe('none')
  })

  it('attaches the bridge only when hosts are allowed', () => {
    const req = request({ networkAllow: ['api.internal'] })
    expect(req.HostConfig.NetworkMode).toBe('bridge')
    expect(req.HostConfig.ExtraHosts).toEqual([])
  })
})

describe('docker create request — privilege', () => {
  it('is never privileged', () => {
    expect(request().HostConfig.Privileged).toBe(false)
  })

  it('drops all capabilities', () => {
    expect(request().HostConfig.CapDrop).toEqual(['ALL'])
  })

  it('forbids gaining new privileges', () => {
    expect(request().HostConfig.SecurityOpt).toContain('no-new-privileges')
  })

  it('does not share the host network, pid, or ipc namespaces', () => {
    const req = request({ networkAllow: ['api.internal'] })
    expect(req.HostConfig.NetworkMode).not.toBe('host')
    expect(req.HostConfig.PidMode).toBe('')
    expect(req.HostConfig.IpcMode).toBe('private')
  })

  it('does not mount the docker socket', () => {
    const sources = request().HostConfig.Mounts.map((m) => m.Source)
    expect(sources).not.toContain('/var/run/docker.sock')
  })
})

describe('docker create request — identity and secrets', () => {
  it('labels the container with its work and workspace', () => {
    const labels = request().Labels
    expect(labels['acp.work_id']).toBe('work_1')
    expect(labels['acp.workspace_id']).toBe('workspace_1')
  })

  it('passes secrets as environment variables', () => {
    expect(request({ secrets: { ACP_TOKEN: 'sekrit' } }).Env).toContain(
      'ACP_TOKEN=sekrit',
    )
  })

  it('never leaks a secret into a label', () => {
    const labels = request({ secrets: { ACP_TOKEN: 'sekrit' } }).Labels
    expect(JSON.stringify(labels)).not.toContain('sekrit')
  })

  it('inherits no environment from the host process', () => {
    // Docker starts with an empty env; the request must not add anything the
    // caller did not name, so a host secret cannot leak in by accident.
    process.env.ACP_TEST_LEAK = 'leaked'
    expect(request().Env.join(',')).not.toContain('leaked')
    delete process.env.ACP_TEST_LEAK
  })

  it('derives a deterministic container name from the work id', () => {
    expect(containerNameFor(workId)).toBe('acp-sandbox-work_1')
    expect(containerNameFor(workId)).toBe(containerNameFor(workId))
  })
})

describe('docker state mapping', () => {
  it.each([
    ['created', 'starting'],
    ['restarting', 'starting'],
    ['running', 'running'],
    ['paused', 'running'],
    ['exited', 'exited'],
    ['dead', 'exited'],
    ['removing', 'exited'],
  ])('maps docker %s to %s', (docker, expected) => {
    expect(toSandboxStatus({ Status: docker, ExitCode: 0 }).status).toBe(
      expected,
    )
  })

  it('reports an unknown docker state as absent rather than guessing', () => {
    expect(toSandboxStatus({ Status: 'wat', ExitCode: 0 }).status).toBe(
      'absent',
    )
  })

  it('carries the exit code only once the container has exited', () => {
    expect(toSandboxStatus({ Status: 'exited', ExitCode: 137 }).exitCode).toBe(
      137,
    )
    expect(
      toSandboxStatus({ Status: 'running', ExitCode: 0 }).exitCode,
    ).toBeUndefined()
  })
})
