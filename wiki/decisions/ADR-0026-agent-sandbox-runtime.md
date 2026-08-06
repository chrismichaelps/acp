---
type: decision
status: ACCEPTED
date: 2026-08-05
tags: [adr, accepted, runtime, sandbox, docker, isolation, leases]
aliases: [ADR-0026, agent-sandbox-runtime]
---

# ADR-0026 — Agent Sandbox Runtime

## Status

ACCEPTED — implemented for the `none` and `docker` adapters.

Delivered: `computeMountPlan`, which projects a work unit's active leases onto
read-write mounts over a read-only workspace; the `SandboxProvider` port with
`NoSandboxLive` as the default; and a `docker` adapter over the Docker Engine
API. The security-relevant payload construction is a pure function
(`toCreateContainerRequest`) so it is asserted exhaustively without a daemon:
read-only root ordered before the writable overlays, egress denied unless hosts
are named, `Privileged: false`, `CapDrop: ["ALL"]`, `no-new-privileges`, private
IPC, no host PID namespace, no Docker socket mount, and no host environment
inherited. `start` is idempotent — the container name is derived from the work
id, so a restart converges on one sandbox instead of accumulating them.

Also delivered: `SandboxService`, which composes a work unit's active leases
into a mount plan and hands it to the configured provider; the
`ACP_SANDBOX_ADAPTER` / `ACP_SANDBOX_IMAGE` / `ACP_WORKSPACE_ROOT` seam,
selecting `docker` without an image being a startup failure rather than a silent
fall back to no isolation; and `POST`, `GET` and `DELETE`
`/v1/work/:work_id/sandbox`.

Provisioning is explicit, not automatic on claim: container start takes seconds
where every other ACP operation takes milliseconds, and claiming work must not
block on it. Provisioning without `ACP_WORKSPACE_ROOT` is refused, because
without a root there is no boundary for leased paths to sit inside and the mount
plan would be unbounded.

Deferred: the microVM-backed `docker-sandbox` adapter, and a network allow-list
— egress is currently denied outright, which is the safe end of that axis.

## Context

ACP coordinates agents but does not run them. An operator wanting parallel
agents must separately arrange isolation, mount the repository, scope network
access, and inject credentials — and then hope each agent honours the leases ACP
hands out. Leases are advisory by construction: ACP records that worker A holds
`login.ts`, and nothing prevents worker B from writing to it anyway. The README
says so plainly. That is the largest gap between what ACP promises and what it
can guarantee.

A 2026 survey of long-running agent runtimes decomposes one into five
primitives, and the mapping onto ACP is the reason this ADR exists:

| Runtime primitive | Owns                                        | ACP today |
| ----------------- | ------------------------------------------- | --------- |
| Session           | Durable append-only log; `wake → resume`    | **Owned** |
| Checkpoint        | Resumable state at step boundaries          | **Owned** |
| Trace             | Structured evidence for postmortems         | **Owned** |
| Harness           | Prompt assembly, model calls, tool dispatch | Not owned |
| Sandbox           | Commands, file changes, environment         | Not owned |

ACP is already three-fifths of an agent runtime. The same survey draws the
boundary in almost exactly ACP's terms: the outer runtime owns approvals,
tracing, handoffs and resume bookkeeping, while the sandbox session owns
commands, file changes and environment isolation.

The ecosystem has converged on how the sandbox half is built. Docker Sandboxes
gives each agent a dedicated microVM with a private in-VM Docker daemon, because
Docker-in-Docker needs elevated privileges that undermine the isolation it is
supposed to provide. Workspaces mount at the same absolute path, environment
variables are deliberately not inherited, network access is an allow/deny list,
and credentials are injected from outside the boundary. Northflank, Modal and
E2B differ in isolation technology — Kata, gVisor, Firecracker — but not in
shape.

## Decision

### ACP owns the sandbox; it does not own the harness

ACP gains the ability to provision, supervise and tear down an isolated
execution environment. It gains no ability to assemble a prompt, call a model,
or decide what an agent should do next. Claude Code, codex, Gemini CLI and
anything else continue to run _inside_.

This is the adoption argument as much as the design one. Harnesses are
proliferating and commoditising — Docker Sandboxes already supports six. A
harness inside ACP would make it the seventh competitor in a crowded space and
would date immediately. Owning the execution boundary instead makes every new
harness a consumer rather than a rival, and it keeps the README's existing
promise — that ACP says nothing about how an agent thinks — literally true.

### A `SandboxProvider` port, with Docker as the first adapter

Sandboxing is a port in the same sense `Storage` is, with adapters selected by
configuration. This is the load-bearing future-proofing decision: isolation
technology is moving quickly, and a design that hardcodes `docker run` is a
design that has to be rewritten when microVMs, Kata or Firecracker become the
default. The port names the capability — _an isolated place to execute, with a
defined filesystem and network surface_ — and leaves the mechanism to adapters.

Three adapters are anticipated; only the first two are in this slice:

- **`none`** — the default. No sandbox is provisioned and behaviour is exactly
  as today, so a host that has not opted in is unchanged.
- **`docker`** — containers via the Docker Engine API.
- **`docker-sandbox`** — microVM-backed, deferred until the tooling stabilises.

### Isolation strength is configuration, not an adapter

The `docker` adapter talks to the Docker Engine API, which every Linux host with
a daemon already exposes. Plain `runc` containers share the host kernel, so they
are a boundary for _first-party_ agents but not for hostile code.

The hardening path is `HostConfig.Runtime`: setting `runsc` reaches gVisor's
syscall interception, and `kata` reaches microVM isolation with its own kernel —
through the **same** Engine API and the same adapter. `ACP_SANDBOX_RUNTIME`
therefore moves a deployment from container-grade to hardware-grade isolation
without changing a line of ACP, which is why isolation strength is a config
value rather than a fork in the code.

**Docker Sandboxes (`sbx`) is deliberately not the server path.** It is a
genuinely good microVM implementation, but it is a CLI aimed at developer
machines: ACP would have to shell out to it, and a long-lived Linux host has no
reason to depend on a desktop-oriented tool when the Engine API plus a hardened
runtime reaches the same isolation. It remains a sensible future adapter for
running ACP locally, which is exactly what a port makes cheap.

### Leases become mounts

This is the point of the feature. A sandbox for a work unit mounts the workspace
**read-only**, and bind-mounts **read-write only the paths the work unit holds
active leases on**.

A lease stops being a promise other agents may ignore and becomes a filesystem
fact they cannot circumvent, without changing the lease protocol at all. The
same shift applies to [[ADR-0023-resource-access-policy]]: a policy denial today
is a 403 the agent could have ignored had it called a different tool; inside a
sandbox it becomes a boundary the process cannot cross.

Mounts are computed when the sandbox starts. A lease acquired afterwards does
**not** widen a running sandbox — it applies at the next start. Live remounting
means mutating a running container's filesystem view, which is exactly the sort
of privileged operation the isolation exists to prevent. This is a real
constraint and is documented rather than papered over: acquire leases before
starting work, which is the workflow ACP already prescribes.

### The sandbox is bound to a work unit

Not to a worker. This follows the reasoning already settled in
[[ADR-0021-work-unit-spawn-graph]]: work units are the durable coordination
node, workers are ephemeral. A sandbox serves the work, survives a worker
crash-and-replace, and a spawned child work unit gets its own sandbox — giving
the spawn graph a physical form.

### Credentials are injected, never stored

The host injects credentials into the sandbox at start. They are never baked
into an image, never written to the event log, and never persisted in a
checkpoint or artifact. The agent inside receives an ACP session token scoped to
its workspace, reusing [[ADR-0015-trusted-session-issuance]] rather than
inventing a second credential path.

### Supervision only; the state machine is unchanged

ACP observes a sandbox's liveness and exit status. It does **not** infer work
state from it. An agent that finishes still transitions its work unit through
the ACP API, and an exited sandbox does not silently complete, fail or cancel
work.

Keeping these separate matters: a container exit code cannot distinguish "the
task is done" from "the process was OOM-killed", and letting infrastructure
decide domain state would make the work lifecycle depend on the scheduler.

### No new event types in this slice

Sandbox state is queryable, not evented. `EventType` is a closed literal union,
so adding members is a protocol change every consumer must handle, and the
runtime's value does not depend on subscribers learning about container starts.
If demand appears, a v0.2 protocol bump can add them deliberately.

## Rationale

The enforcement win justifies the feature on its own. Everything ACP records
about who may touch what is currently advisory, and advisory guarantees are the
ones that fail exactly when a system is under the pressure it was built for. The
sandbox is the only place that gap can be closed, because it is the only place
ACP would control the filesystem an agent sees.

Refusing the harness is what keeps the feature small enough to be correct. The
sandbox half is bounded — provision, mount, supervise, destroy — and testable
without a model in the loop. The harness half is unbounded, changes monthly, and
is already well served.

Making it a port rather than a Docker integration is the difference between a
feature that survives the next isolation shift and one that does not. Docker
itself moved from containers to microVMs for this workload inside a single
release cycle.

## Consequences

An operator opting in accepts that ACP launches processes. That is a
substantially larger blast radius than a coordination host has today, which is
why `none` is the default, why the adapter is explicit configuration, and why
credential handling is specified rather than left to convention.

Leases gain teeth, and with them a sharper failure mode: an agent that did not
acquire a lease will find the path read-only rather than receiving a conflict
error. That is the intended behaviour, and it must be documented in
`ACP-SKILL.md` and [[agent-integration]] before the adapter is recommended,
because it changes what "advisory" means in the agent contract.

Sandbox provisioning is slow relative to every other ACP operation — seconds,
not milliseconds. The provisioning call is therefore asynchronous with respect
to the work claim: claiming work does not block on a container start.

Docker-in-Docker is explicitly out of scope for the `docker` adapter. An agent
needing to build images needs the microVM adapter, for the privilege reasons
Docker documents.

## Alternatives

**Owning the harness too.** Rejected: puts ACP in competition with the agents it
coordinates, in a space that is commoditising fast, and breaks the scope promise
the README makes today.

**Supervision without execution** — record which container a worker runs in, but
never launch one. Rejected: it is the smallest change and the safest, but leases
stay advisory, so it misses the entire enforcement win that motivates the ADR.

**Hardcoding Docker.** Rejected: isolation technology is mid-shift, and Docker's
own answer for this workload moved from containers to microVMs within a release
cycle.

**Binding sandboxes to workers.** Rejected for the reason ADR-0021 rejected
worker-scoped lineage: workers are ephemeral, and the sandbox would die with the
process whose work still needs doing.

**Inferring work state from exit codes.** Rejected: an exit code cannot separate
success from an OOM kill, and domain state must not depend on the scheduler.

**Live remounting on lease acquisition.** Rejected: mutating a running
container's mounts is precisely the privileged operation the boundary exists to
prevent.

## Validation

Acceptance requires tests proving: the `none` adapter leaves every existing
behaviour and event payload unchanged; mount computation grants read-write only
for paths under active leases held by that work unit, and read-only elsewhere;
an expired or released lease is excluded; a lease held by a _different_ work
unit is excluded; credentials never appear in any event, artifact or checkpoint;
an exited sandbox leaves work state untouched; and a sandbox is addressed by
work unit, surviving a change of assigned worker.

Plus a dogfood script in which two work units run concurrently, each seeing only
its own leased paths as writable, and the full typecheck/lint/format/suite gate.

## Grill Log

- **Q:** Why not own the harness, when that would make ACP a complete runtime?
  **A:** Because complete is not the same as durable. Harnesses change monthly
  and are already well served; the coordination-plus-enforcement substrate is
  neither. Owning the boundary makes new harnesses customers instead of
  competitors. _Rejected:_ a built-in agent loop.
- **Q:** Why a port when Docker is the only adapter being written? **A:** Docker
  moved this workload from containers to microVMs inside one release cycle. The
  port costs an interface; hardcoding costs a rewrite. _Rejected:_ direct Docker
  integration.
- **Q:** Why not remount when a new lease is acquired? **A:** It requires
  privileged mutation of a running container — the exact capability the sandbox
  exists to deny. Recomputing at start is honest and matches the prescribed
  acquire-then-work flow. _Rejected:_ live mount updates.
- **Q:** Should a sandbox exiting cleanly complete the work unit? **A:** No. An
  exit code cannot distinguish completion from an OOM kill, and domain state
  must not be decided by the scheduler. _Rejected:_ exit-code-driven
  transitions.

## Referenced by

[[00-INDEX]]
