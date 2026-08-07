---
type: decision
status: ACCEPTED
date: 2026-08-04
tags: [adr, accepted, hooks, gates, extensibility, transitions]
aliases: [ADR-0022, coordination-hooks]
---

# ADR-0022 — Coordination Hooks

## Status

ACCEPTED — implemented.

Delivered: `HookPoint`, `HookOutcome`, and `Hook` in `src/domain/hooks/`;
`makeHookDispatcher` with sequential name-ordered dispatch, first-abort-wins,
and fail-closed per-hook timeouts; `HookDeniedError` mapped to HTTP 403
`forbidden`; the `acp_hook_outcomes_total` counter; and all four points wired —
`work.before_claim` and `work.before_transition` in the work unit service,
`lease.before_grant` in the lease service, `review.before_verdict` in the review
service. `NoHooksLive` is the default in `AppLive`, so a host that registers
nothing behaves exactly as before.

**Webhook hooks now ship**, reversing half of the deferral below.

The original objection was that external hooks need a sandboxing story and put
unbounded third-party latency in front of every lease grant. Webhooks answer
both without new machinery: no code runs in the host, so there is nothing to
sandbox, and the per-hook fail-closed timeout this ADR already specifies is
exactly what bounds the latency. Subprocess hooks remain deferred — those are
the ones that would need sandboxing.

`ACP_HOOKS_FILE` declares them, so operators register gates by configuration
rather than by recompiling the host, which was the real usability cost of
assembly-time registration. Endpoints must be **https**: a plaintext endpoint
would carry coordination details in the clear, and any hop could forge a verdict
the host treats as authoritative. Every failure — unreachable, slow, or an
undecodable verdict — is a `DenyAbort`, because an endpoint that is down cannot
be told apart from one that would have denied.

The verdict wire format requires a reason on both denial shapes, enforcing what
the local `HookOutcome` type already makes unconstructable. It deliberately
tolerates unrecognised fields: rejecting them would turn a benign
`{ decision: "allow", requestId: "…" }` into a fail-closed refusal, bricking
coordination over harmless metadata.

Policy hooks are name-prefixed `00-`, so a local denial never pays for a network
round trip first.

## Context

ACP's event log is append-only and fire-and-forget: a subscriber learns that a
lease was granted or a work unit changed state, but only after the fact.
Nothing can refuse a coordination mutation. Every policy an operator wants to
impose — "this worker may not claim work in this workspace", "no lease on the
migration directory during a release freeze", "a review verdict requires a
passing grill" — has to be enforced outside the host, by convention, in every
client. Convention is exactly what ACP exists to replace.

`codex-rs/hooks` from [`openai/codex`](https://github.com/openai/codex) supplies
the missing shape: a hook returns one of three outcomes — success, failure that
lets the operation continue, or failure that **aborts** the operation. The third
is what turns a notification into a gate. Codex also enforces that a blocking
decision must carry a reason, applies a per-handler timeout, and fails closed on
output fields it does not yet implement.

## Decision

### Pre-mutation only

Hooks run before a mutation, never after. ACP already has a complete, durable,
ordered "after" channel — the event log — and a second, weaker one would
duplicate it while giving subscribers two places to look. Hooks exist solely to
answer a question the event log cannot: _may this happen at all?_

### A closed set of hook points

`HookPoint` is a closed literal union, not an open string, so the gated surface
is auditable and a typo is a decode error rather than a hook that silently never
fires:

`work.before_claim`, `work.before_transition`, `lease.before_grant`,
`review.before_verdict`.

These are the four mutations where a refusal is meaningful. The set grows by
amendment to this ADR, not by configuration.

### Three outcomes, deterministic order, first abort wins

```ts
type HookOutcome =
  | { _tag: 'Allow' }
  | { _tag: 'DenyContinue'; reason: string } // record, run the rest, allow
  | { _tag: 'DenyAbort'; reason: string } // stop dispatch, refuse mutation
```

Hooks for a point run **sequentially in declared name order**. Sequential rather
than concurrent because a gate's answer must be reproducible: the dogfood
scripts assert exact output, and concurrent dispatch makes "which hook denied
first" a race. The first `DenyAbort` short-circuits the remainder.

`reason` is required on both denial outcomes at the type level. Codex enforces
this as a semantic rule during output parsing because its wire format cannot; in
Effect Schema the constraint is expressible in the type itself, so an unreasoned
denial cannot be constructed.

### In-process only, for now

Hooks are registered as an Effect `Layer` at host assembly. There is no
subprocess execution and no outbound network call.

This is the deliberate narrow slice. Codex runs external command hooks because
it is a local CLI on a developer's machine; ACP is a long-lived shared host,
frequently in Docker, sitting in the mutation path of every agent in a
workspace. Spawning arbitrary processes inside that container needs a sandboxing
story, and calling webhooks puts unbounded third-party latency in front of every
lease grant. Neither belongs in the slice that establishes the seam. External
hooks become their own ADR once the seam is proven.

### Timeouts fail closed, per hook

Every hook declares `timeoutMs` (default `2000`). On expiry the outcome is
`DenyAbort` with a generated reason naming the hook.

Fail-closed follows the precedent set by the [[ADR-0020-operational-contracts]]
version guard: when ACP cannot establish that an operation is safe, it refuses.
A hung hook that silently allowed mutations would be a gate that disappears
exactly when something is wrong. The cost is real and is stated in Consequences.

### Hooks observe; they do not rewrite

The payload is read-only and the return value carries no mutation. A hook cannot
edit the work unit, change the lease TTL, or alter the transition target.

Codex reserves several rewrite fields and fails closed when they are present.
ACP takes the same stance with less ceremony: the capability does not exist in
the type, so there is nothing to fail closed on. Rewriting would make the
mutation's inputs depend on hook order, and the event log would then record a
change no client requested.

### Denials are metrics, not events

A denied mutation appends nothing to the event log — nothing happened, matching
how `InvalidStateTransitionError` and the [[ADR-0021-work-unit-spawn-graph]]
completion gate already behave.

Denials are observable through an additive counter on the existing
[[ADR-0019-metrics-scrape-endpoint]] surface, labelled by hook point, hook name,
and outcome, plus a structured log carrying the reason. The reason is also
returned to the caller in the error body, since an agent that is refused must be
able to act on why.

## Rationale

Pre-mutation-only, in-process-only, and no-rewrite are each a deliberate
narrowing of codex's design, and together they are the point of this ADR. The
valuable idea is the abort outcome; the surrounding machinery — subprocess
discovery, output spilling, token budgets for hook stdout — exists to serve a
local CLI's plugin ecosystem, not a coordination host's invariants. Importing it
wholesale would add a sandboxing problem, a latency problem, and an ordering
problem in exchange for capability nothing has asked for yet.

Requiring `reason` at the type level is small and disproportionately valuable.
An agent refused without explanation retries, and a retrying agent against a
deterministic gate is an infinite loop.

## Consequences

Any mutation at a gated point can now fail for a new reason, so clients need to
handle a hook-denial error. It maps to HTTP 403 — the request was well-formed
and the session was authorized, but policy refused it — distinguishing it from
the 409 conflicts that mean "retry later".

A misbehaving hook can halt coordination. Fail-closed timeouts mean a hook that
hangs blocks every mutation at its point until it is removed. This is accepted
as the correct default, but it makes hook registration an operational act: hooks
are host-assembly code, they ship with the deployment, and the metrics counter
exists so a wedged gate is visible immediately rather than diagnosed from agent
retry storms.

Sequential dispatch means hook latency sums. With the default timeout and a
handful of hooks, worst-case added latency at a gate is bounded and knowable —
which is the reason for a mandatory timeout rather than an optional one.

## Alternatives

**External command hooks**, codex's model. Rejected for this slice: needs a
sandboxing story inside a shared, often containerized host. Deferred to its own
ADR.

**Webhook hooks.** Rejected for this slice: puts unbounded third-party network
latency in the critical path of every lease grant.

**Post-mutation hooks.** Rejected as a duplicate of the event log, with weaker
delivery guarantees than the log already provides.

**Fail-open timeouts.** Rejected: a gate that vanishes under load is worse than
no gate, because operators would rely on it.

**Rewrite-capable hooks.** Rejected: makes mutation inputs order-dependent and
causes the event log to record changes no client requested.

**Concurrent dispatch.** Rejected: makes "which hook denied" nondeterministic,
which the dogfood scripts cannot assert against.

## Validation

Acceptance requires tests proving: a `DenyAbort` refuses the mutation, appends
no event, and leaves stored state byte-identical; a `DenyContinue` records the
denial but permits the mutation; dispatch order follows declared name order and
short-circuits at the first abort; a hook exceeding `timeoutMs` yields
`DenyAbort` naming the hook; every one of the four hook points actually fires,
verified per point rather than in aggregate; a host with no hooks registered
behaves exactly as today, event payloads included; and the denial counter
increments with correct labels.

Plus a dogfood script in which a hook refuses a lease grant on a protected
resource and the refused agent receives an actionable reason — and the full
typecheck/lint/format/suite gate.

## Grill Log

- **Q:** Why not post-mutation hooks too, for symmetry? **A:** The event log is
  already the post-mutation channel, with ordering and durability guarantees a
  hook cannot match. Symmetry is not a requirement. _Rejected:_ an "after" hook
  phase.
- **Q:** Fail-closed timeouts let one bad hook stop all work. Is that right?
  **A:** Yes, and it matches the version guard in ADR-0020. A gate that silently
  stops gating is the worse failure, because operators build on it. The counter
  makes the wedge immediately visible. _Rejected:_ fail-open on timeout.
- **Q:** Why in-process when codex runs external commands? **A:** Codex is a
  local CLI; ACP is a shared host in the mutation path for every agent. External
  execution needs sandboxing and unbounded latency budgets that this slice
  should not be carrying. _Rejected:_ subprocess and webhook hooks in v1.
- **Q:** Why is a denial not an event? **A:** Nothing changed. The log records
  facts about state, and consistency with the existing transition errors matters
  more than making denials easy to subscribe to. _Rejected:_ a `hook.denied`
  event type.

## Referenced by

[[00-INDEX]]
