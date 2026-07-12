---
type: decision
status: ACCEPTED
date: 2026-07-12
tags: [adr, dogfood, agents, docker, testing]
aliases: [ADR-0011, live-agent-docker-dogfood-runner]
---

# ADR-0011 — External Live-Agent Docker Dogfood Runner

## Context

ACP's required `dogfood:docker-self` gate builds the production image and proves
CLI, REST, SSE, JSON-RPC, native RPC, persistence, authorization, HA, and edge
behavior. Its planner/worker/reviewer identities are scripted fixtures, however;
no model process reasons, edits files, recovers from conflict, or consumes a
handoff.

`scripts/live-test/` contains prompts for real planner, worker, and reviewer
agents, but it is a manual recipe: a human session launches every role against a
native host. It has no package command, Docker host, process supervision,
provider evidence, structured role results, deterministic contention, or robust
cleanup. Its verifier also accepts an empty memory list and does not verify the
fixture's actual code behavior.

Production readiness therefore needs a repeatable model-backed lane without
turning ACP itself into a model host.

## Decision

Add an opt-in external `LiveAgentDogfoodRunner`, invoked by
`pnpm dogfood:docker-agents`.

The runner executes on the developer/CI host and owns provider invocation. It
builds and starts the ordinary production ACP Docker image; no model SDK, agent
binary, repository checkout, provider token, or Docker socket is added to that
image. Agents coordinate only through the shipped ACP CLI/public API and edit
only an isolated throwaway git fixture.

The first provider adapter is the installed `codex exec` CLI. Provider selection,
model name, timeouts, and evidence retention are runner configuration, not ACP
protocol or host configuration. A later provider adapter may launch Claude Code
without changing ACP.

The lane is opt-in because model execution has credential, cost, latency, and
nondeterminism constraints. Deterministic `dogfood:docker-self` remains the
mandatory pull-request gate. A credentialed scheduled/manual workflow may invoke
the model lane after local proof.

## Interface

```text
pnpm dogfood:docker-agents

ACP_LIVE_AGENT_PROVIDER=codex
ACP_LIVE_AGENT_MODEL=<optional model override>
ACP_LIVE_AGENT_TIMEOUT_MS=900000
ACP_LIVE_AGENT_RUN_ID=<optional stable id>
ACP_LIVE_AGENT_KEEP_RUN=on-failure|always|never
ACP_DOCKER_SKIP_BUILD=true|false
```

The command exits zero only when `[[live-agent-docker-dogfood]]` acceptance
evidence passes and writes a machine-readable report plus per-role transcripts
and structured results beneath the isolated run directory.

## Security Boundary

- ACP runs in its normal production container with SQLite durability,
  `ACP_REQUIRE_AUTH=true`, and `ACP_REQUIRE_WORKSPACE_BINDINGS=true` for agent
  execution.
- A bootstrap phase creates the fixture workspace before binding enforcement is
  enabled; the same durable volume is then restarted hardened and every agent
  session binds to that workspace.
- Provider credentials remain on the host and are never mounted or forwarded to
  ACP.
- Codex roles use workspace-write sandboxing rooted at the throwaway fixture.
- The active developer worktree is never an agent write target.
- Bearer session ids are not written to transcripts or reports.

## Acceptance Evidence

The verifier requires all of the following:

1. Real provider processes for planner, two workers, and reviewer started,
   exited successfully within their deadlines, and produced schema-valid result
   files.
2. The planner created exactly two work units; both reached `completed`.
3. A harness-owned contention lease caused both workers to observe a real
   `lease_conflict`; the guard and all worker leases are released before finish.
4. At least one review followed `changes_requested → new review → approved`, and
   at least one approval occurred.
5. Each completed work has nonempty checkpoint and handoff memory evidence; the
   reviewer result names the memory ids it inspected.
6. Event sequence is strictly monotonic and API/SQLite readback agrees.
7. Distinct planner/worker/reviewer actors appear in durable events.
8. Fixture behavior passes executable tests (`add` and `capitalize`), not merely
   ACP metadata assertions.
9. The report records provider/version/model, duration, role exits, invariant
   results, and retained evidence paths without secrets.

## Failure and Cleanup

Every child process has a deadline. On timeout or failure, the runner terminates
the child tree, stops/removes the ACP container and volume, and retains the run
directory by default. Successful runs remove container/volume and retain or
delete fixture evidence according to `ACP_LIVE_AGENT_KEEP_RUN`.

No retry may silently replace a failed role. A retry is a new correlated run so
model instability and ACP defects remain observable.

## Rejected Alternatives

- **Embed provider SDKs or agent binaries in ACP.** Rejected: couples the
  provider-neutral protocol host to model vendors and expands its credential and
  supply-chain surface.
- **Mount host credentials or Docker socket into ACP.** Rejected: unnecessary
  privilege escalation; the external runner already owns processes and cleanup.
- **Call scripted fixtures “real agents.”** Rejected: validates transport logic,
  not reasoning, file edits, recovery, or handoff consumption.
- **Make the model lane a mandatory PR check.** Rejected: credentials, cost, and
  model nondeterminism make it unsuitable as the deterministic merge gate.
- **Run agents in the developer's active worktree.** Rejected: concurrency and
  model mistakes could damage unrelated user changes.

## Consequences

ACP gains a repeatable proof that its shipped control plane coordinates real
agents, while the core image and protocol remain vendor-neutral. The fixture
lane establishes runner trust first. A later bounded slice may point the same
runner at isolated ACP clones/worktrees to discover and repair repository bugs,
but must never mutate the active checkout.

## Referenced by

[[live-agent-docker-dogfood]] · [[codex-dogfood-production-testing]] ·
[[architecture/_MOC]] · [[decisions/_MOC]]
