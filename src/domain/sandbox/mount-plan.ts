/** @Acp.Domain.Sandbox.MountPlan — leases projected onto sandbox mounts */
import { posix } from 'node:path'
import { Option } from 'effect'
import type { Lease, Timestamp, WorkId } from '../../protocol/schema/index.js'

/** One bind mount a sandbox adapter must materialise. */
export interface Mount {
  readonly source: string
  readonly target: string
  readonly writable: boolean
}

export interface RejectedMount {
  readonly uri: string
  readonly reason: string
}

export interface MountPlan {
  /** The workspace, always read-only — writability is granted per lease. */
  readonly root: Mount
  /** Read-write mounts, ordered by target so a plan is reproducible. */
  readonly writable: readonly Mount[]
  /** Leases deliberately not mounted, with the reason, for operator visibility. */
  readonly rejected: readonly RejectedMount[]
}

export interface MountPlanInput {
  readonly workspaceRoot: string
  readonly workId: WorkId
  readonly leases: readonly Lease[]
  readonly now: Timestamp
}

/** Only these resource kinds name a filesystem path. */
const pathKinds: ReadonlySet<string> = new Set([
  'file',
  'directory',
  'worktree',
])

const FILE_SCHEME = 'file://'

/**
 * Resolves a `file://` URI to a normalised absolute path, or `undefined` when
 * the URI does not name one.
 */
const toPath = (uri: string): string | undefined =>
  uri.startsWith(FILE_SCHEME)
    ? posix.normalize(decodeURIComponent(uri.slice(FILE_SCHEME.length)))
    : undefined

/**
 * True when `candidate` sits strictly inside `root`.
 *
 * The trailing separator matters: without it `/srv/workspace-other` and
 * `/srv/workspaceevil` both pass a naive `startsWith` check and would be
 * mounted writable on the host. Equality is also excluded — the root itself is
 * mounted read-only, and granting write on it would defeat the whole plan.
 */
const isInside = (root: string, candidate: string): boolean =>
  candidate !== root && candidate.startsWith(`${root}/`)

/**
 * Projects a work unit's active leases onto the mounts its sandbox may have.
 *
 * This is where a lease stops being advisory. The workspace is mounted
 * read-only and each leased path is bind-mounted read-write, so an agent that
 * never acquired a lease cannot write the file regardless of what it tries —
 * see [[ADR-0026-agent-sandbox-runtime]].
 */
export const computeMountPlan = (input: MountPlanInput): MountPlan => {
  const root = posix.normalize(input.workspaceRoot)
  const writable = new Map<string, Mount>()
  const rejected: RejectedMount[] = []

  for (const lease of input.leases) {
    if (lease.state !== 'active') continue
    // An active row past its deadline has not been swept yet; it confers
    // nothing, so the plan must not treat it as a grant.
    if (lease.expires_at <= input.now) continue
    if (Option.isNone(lease.work_id) || lease.work_id.value !== input.workId) {
      continue
    }
    if (!pathKinds.has(lease.resource.kind)) continue

    const path = toPath(lease.resource.uri)
    if (path === undefined) continue

    if (!isInside(root, path)) {
      rejected.push({
        uri: lease.resource.uri,
        reason: `resolves to ${path}, which is outside the workspace root ${root}`,
      })
      continue
    }

    writable.set(path, { source: path, target: path, writable: true })
  }

  return {
    root: { source: root, target: root, writable: false },
    writable: [...writable.values()].sort((left, right) =>
      left.target < right.target ? -1 : left.target > right.target ? 1 : 0,
    ),
    rejected,
  }
}
