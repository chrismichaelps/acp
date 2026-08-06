/** @Acp.Infra.Sandbox.DockerRequest — pure Docker Engine payload construction */
import type { SandboxSpec, SandboxStatus } from '../../domain/sandbox/index.js'
import type { WorkId } from '../../protocol/schema/index.js'

export interface DockerMount {
  readonly Type: 'bind'
  readonly Source: string
  readonly Target: string
  readonly ReadOnly: boolean
}

export interface CreateContainerRequest {
  readonly Image: string
  readonly Labels: Readonly<Record<string, string>>
  readonly Env: readonly string[]
  readonly HostConfig: {
    readonly Mounts: readonly DockerMount[]
    readonly NetworkMode: string
    readonly ExtraHosts: readonly string[]
    readonly Privileged: false
    readonly CapDrop: readonly string[]
    readonly SecurityOpt: readonly string[]
    readonly PidMode: string
    readonly IpcMode: string
    /**
     * OCI runtime. Omitted means the daemon default (`runc`), which shares the
     * host kernel and is not a boundary for hostile code. Setting `runsc`
     * (gVisor) or `kata` (microVM) hardens the sandbox through the same Engine
     * API — the reason isolation strength is configuration, not a rewrite.
     */
    readonly Runtime?: string
  }
}

/** Deterministic, so a restart addresses the same sandbox for the same work. */
export const containerNameFor = (workId: WorkId): string =>
  `acp-sandbox-${workId}`

/**
 * Builds the Docker Engine create payload for a sandbox.
 *
 * Everything security-relevant is decided here rather than in the I/O layer, so
 * it can be asserted exhaustively without a Docker daemon: the root is
 * read-only, only leased paths are writable, egress is denied unless hosts are
 * named, no capabilities are retained, and nothing is inherited from the host
 * environment. See [[ADR-0026-agent-sandbox-runtime]].
 */
export const toCreateContainerRequest = (
  spec: SandboxSpec,
  image: string,
  runtime?: string,
): CreateContainerRequest => ({
  Image: image,
  Labels: {
    'acp.work_id': spec.workId,
    'acp.workspace_id': spec.workspaceId,
  },
  // Only what the caller named. Docker starts with an empty environment, so a
  // host variable cannot reach the agent unless it was passed deliberately.
  Env: Object.entries(spec.secrets).map(([key, value]) => `${key}=${value}`),
  HostConfig: {
    // The read-only root must precede the writable overlays: Docker applies
    // binds in order, and a root applied last would shadow them.
    Mounts: [
      {
        Type: 'bind',
        Source: spec.root.source,
        Target: spec.root.target,
        ReadOnly: true,
      },
      ...spec.writable.map((mount): DockerMount => ({
        Type: 'bind',
        Source: mount.source,
        Target: mount.target,
        ReadOnly: false,
      })),
    ],
    // Deny egress by default; an allow-list opts into the bridge.
    NetworkMode: spec.networkAllow.length === 0 ? 'none' : 'bridge',
    ExtraHosts: [],
    Privileged: false,
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges'],
    // Empty PidMode and private IpcMode keep the container out of the host
    // namespaces; sharing either would defeat the isolation entirely.
    PidMode: '',
    IpcMode: 'private',
    ...(runtime === undefined ? {} : { Runtime: runtime }),
  },
})

export interface DockerState {
  readonly Status: string
  readonly ExitCode: number
}

/**
 * Maps Docker's container state onto ACP's vocabulary.
 *
 * An unrecognised state maps to `absent` rather than being guessed at: claiming
 * a sandbox is `running` when ACP cannot tell would be worse than admitting it
 * does not know.
 */
export const toSandboxStatus = (
  state: DockerState,
): { readonly status: SandboxStatus; readonly exitCode?: number } => {
  switch (state.Status) {
    case 'created':
    case 'restarting':
      return { status: 'starting' }
    case 'running':
    case 'paused':
      return { status: 'running' }
    case 'exited':
    case 'dead':
    case 'removing':
      return { status: 'exited', exitCode: state.ExitCode }
    default:
      return { status: 'absent' }
  }
}
