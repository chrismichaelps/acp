/** @Acp.Domain.Sandbox.MountPlan.Test — leases become writable mounts */
import { describe, expect, it } from 'vitest'
import { Option, Schema } from 'effect'
import {
  LeaseId,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type {
  Lease,
  LeaseState,
  ResourceKind,
} from '../../protocol/schema/index.js'
import { computeMountPlan } from './mount-plan.js'

const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_1')
const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const otherWorkId = Schema.decodeUnknownSync(WorkId)('work_2')
const holder = Schema.decodeUnknownSync(WorkerId)('agent_a')
const now = Schema.decodeUnknownSync(Timestamp)('2026-08-05T10:00:00Z')
const later = Schema.decodeUnknownSync(Timestamp)('2026-08-05T11:00:00Z')
const earlier = Schema.decodeUnknownSync(Timestamp)('2026-08-05T09:00:00Z')

const root = '/srv/workspace'

let seq = 0
const lease = (over: {
  readonly uri: string
  readonly state?: LeaseState
  readonly kind?: ResourceKind
  readonly work?: WorkId
  readonly expires?: Timestamp
}): Lease => ({
  id: Schema.decodeUnknownSync(LeaseId)(`lease_${String((seq += 1))}`),
  workspace_id: workspaceId,
  work_id: Option.some(over.work ?? workId),
  holder,
  resource: { kind: over.kind ?? 'file', uri: over.uri },
  expires_at: over.expires ?? later,
  state: over.state ?? 'active',
})

const plan = (leases: readonly Lease[]) =>
  computeMountPlan({ workspaceRoot: root, workId, leases, now })

describe('mount plan', () => {
  it('mounts the workspace root read-only', () => {
    const result = plan([])
    expect(result.root).toEqual({ source: root, target: root, writable: false })
  })

  it('grants read-write for a path under an active lease', () => {
    const result = plan([lease({ uri: 'file:///srv/workspace/src/app.ts' })])
    expect(result.writable).toEqual([
      {
        source: '/srv/workspace/src/app.ts',
        target: '/srv/workspace/src/app.ts',
        writable: true,
      },
    ])
  })

  it('orders writable mounts deterministically by target', () => {
    const result = plan([
      lease({ uri: 'file:///srv/workspace/b.ts' }),
      lease({ uri: 'file:///srv/workspace/a.ts' }),
    ])
    expect(result.writable.map((m) => m.target)).toEqual([
      '/srv/workspace/a.ts',
      '/srv/workspace/b.ts',
    ])
  })

  it.each(['expired', 'released', 'revoked'] as const)(
    'excludes a %s lease',
    (state) => {
      const result = plan([
        lease({ uri: 'file:///srv/workspace/src/app.ts', state }),
      ])
      expect(result.writable).toEqual([])
    },
  )

  it('excludes an active lease whose deadline has passed', () => {
    const result = plan([
      lease({ uri: 'file:///srv/workspace/src/app.ts', expires: earlier }),
    ])
    expect(result.writable).toEqual([])
  })

  it('excludes a lease held for a different work unit', () => {
    const result = plan([
      lease({ uri: 'file:///srv/workspace/src/app.ts', work: otherWorkId }),
    ])
    expect(result.writable).toEqual([])
  })

  it('excludes a lease with no work unit at all', () => {
    const orphan: Lease = {
      ...lease({ uri: 'file:///srv/workspace/src/app.ts' }),
      work_id: Option.none(),
    }
    expect(plan([orphan]).writable).toEqual([])
  })

  it.each(['branch', 'task', 'service', 'custom'] as const)(
    'ignores a %s resource, which names no path',
    (kind) => {
      const result = plan([lease({ uri: 'refs/heads/main', kind })])
      expect(result.writable).toEqual([])
    },
  )

  it('accepts a directory lease', () => {
    const result = plan([
      lease({ uri: 'file:///srv/workspace/src', kind: 'directory' }),
    ])
    expect(result.writable.map((m) => m.target)).toEqual(['/srv/workspace/src'])
  })

  // Path containment is the security boundary: a lease naming anything outside
  // the workspace must never become a writable mount on the host.
  it.each([
    'file:///etc/passwd',
    'file:///srv/workspace/../../etc/passwd',
    'file:///srv/workspace-other/secret',
    'file:///srv/workspaceevil/x',
  ])('refuses to mount %s, which escapes the workspace root', (uri) => {
    const result = plan([lease({ uri })])
    expect(result.writable).toEqual([])
    expect(result.rejected).toHaveLength(1)
  })

  it('reports why a path was rejected', () => {
    const result = plan([lease({ uri: 'file:///etc/passwd' })])
    expect(result.rejected[0]?.reason).toMatch(/outside the workspace root/i)
  })

  it('normalises a traversal that still lands inside the workspace', () => {
    const result = plan([
      lease({ uri: 'file:///srv/workspace/src/../lib/a.ts' }),
    ])
    expect(result.writable.map((m) => m.target)).toEqual([
      '/srv/workspace/lib/a.ts',
    ])
  })

  it('never mounts the workspace root itself as writable', () => {
    const result = plan([lease({ uri: 'file:///srv/workspace' })])
    expect(result.writable).toEqual([])
    expect(result.rejected).toHaveLength(1)
  })

  it('deduplicates two leases naming the same path', () => {
    const result = plan([
      lease({ uri: 'file:///srv/workspace/a.ts' }),
      lease({ uri: 'file:///srv/workspace/a.ts' }),
    ])
    expect(result.writable).toHaveLength(1)
  })

  it('ignores a non-file uri scheme', () => {
    const result = plan([lease({ uri: 'https://example.com/a.ts' })])
    expect(result.writable).toEqual([])
  })
})
