---
type: decision
status: PROPOSED
date: 2026-08-04
tags: [adr, proposed, policy, authorization, resources, leases]
aliases: [ADR-0023, resource-access-policy]
---

# ADR-0023 — Resource Access Policy

## Status

PROPOSED.

## Context

ACP authorizes by permission scope: a session holds `lease:create` or it does
not. The vocabulary is a closed `Schema.Literal` union in [[common]], fixed by
spec §8. It answers "may this session call this operation at all" and stops
there.

It cannot answer the question operators actually have, which is always about a
_particular_ resource: this worker may lease source files but not the migrations
directory; this workspace's CI worker may create work units but never approve
reviews; a lease on the release branch requires review rather than being granted
outright. Every one of those is a per-resource rule, and today the only way to
express one is to withhold the whole scope.

`codex-rs/execpolicy` from [`openai/codex`](https://github.com/openai/codex)
solves the analogous problem for shell commands. Three of its properties
transfer directly: a three-valued decision rather than a boolean; a
`justification` on every rule that is surfaced in the rejection message; and
`match`/`not_match` example invocations **validated when the policy loads**, so
rules ship with their own tests and a policy that no longer does what it claims
refuses to load.

## Decision

### Policy layers above permissions; the `Permission` union is untouched

`Permission` stays exactly as it is. It is a closed v0.1 protocol vocabulary,
and changing it is a protocol break for every client and the OpenAPI contract.

The two mechanisms answer different questions and both must pass:

- **Permission** — may this session invoke this operation? Unchanged, checked
  first.
- **Policy** — may this worker take this action against this specific resource?
  New, checked after.

Keeping them separate means policy is purely additive: it can only narrow what a
permission already allows, never widen it. A policy file cannot become a
privilege-escalation path.

### Three decisions, with `prompt` adapted to ACP's reality

```ts
type PolicyDecision = 'allow' | 'deny' | 'require_review'
```

Codex's middle value is `prompt`, which asks a human sitting at a terminal.
ACP's callers are autonomous agents and there is no terminal. The faithful
translation is not "ask a human synchronously" but "route this through the
gate ACP already has": `require_review` admits the action into `needs_review`
rather than completing it, reusing the existing review machinery instead of
inventing a second approval channel.

### Rules are declarative data, validated by Effect Schema

Policy is a JSON document decoded by an Effect Schema, not a Starlark program.

Codex embeds a Starlark interpreter, which buys expressiveness at the cost of a
language runtime. ACP already decodes every wire and config shape through Effect
Schema; reusing it means zero new runtime dependency, decode errors that read
like every other ACP error, and a policy file that diffs cleanly in review. The
expressiveness lost is real — no computed rules — and is judged not worth an
interpreter. If policies ever need computation, a hook (see
[[ADR-0022-coordination-hooks]]) is the right escape hatch.

A rule matches on action, an optional worker predicate, and a resource pattern
matched against ACP's existing `Resource { kind, uri }`. Rules are ordered and
**first match wins**, which is predictable to read and cheap to evaluate.

### Every rule carries a justification, surfaced on denial

`justification` is required on `deny` and `require_review` rules, and returned
in the error body.

This is the single highest-value idea taken from execpolicy. An agent refused
without a reason retries; an agent told "the migrations directory is release-gated,
open a work unit instead" can act. The rule that codex applies by convention —
that a `forbidden` justification should name the alternative — is documented
guidance here too, but the field itself is enforced by the type.

### Policies self-test at load, and fail closed

Every rule may declare `match` and `notMatch` example actions. On load, ACP
asserts each `match` example resolves to that rule and each `notMatch` example
does not. Any failure aborts load and the host refuses to start.

Rules ship with their own tests, and refusing to start is the only safe response
to a policy that no longer means what it says — a silently-misfiring access rule
is worse than an absent one, and matches how the [[ADR-0020-operational-contracts]]
version guard treats an unverifiable store.

### Opt-in, with an explicit default

No policy file configured means the engine is absent and behavior is exactly as
today. When a file is present it must declare a top-level `default` decision;
there is no implicit fallback. An operator who writes rules has necessarily
thought about what happens when none match, and guessing on their behalf — in
either direction — is how policy engines produce surprises.

### Host policy plus optional per-workspace overlay

A workspace overlay may add rules and override matching ones; the overlay is
evaluated first. ACP is workspace-scoped throughout, and codex's `merge_overlay`
shows the layering is cheap. An overlay can only be _more_ restrictive than the
host default it inherits, preserving the narrowing property.

## Rationale

The layering decision does most of the work. Treating policy as a replacement
for `Permission` would have meant a protocol break, an OpenAPI regeneration, and
a migration for every client, in exchange for capability that composes perfectly
well as a second, additive check. Because policy can only narrow, the blast
radius of a bad policy file is a denial — recoverable and loud — never an
unintended grant.

Load-time self-validation is the property most worth importing. Access rules rot
silently: a pattern stops matching after a resource-naming change and nobody
notices until an incident. Making rules carry executable examples turns that
class of rot into a startup failure.

## Consequences

Actions at policy-covered points gain a new failure mode, HTTP 403 with a
justification in the body, distinct from the 409 conflicts that mean "retry".
Agents must surface that justification rather than retrying blindly.

A malformed or self-inconsistent policy prevents host startup. That is intended,
but it makes policy files deployment-critical artifacts: they need review, and
`require_review` rules need a reviewer who exists, or work routed there will sit.

Policy evaluation is on the hot path for covered actions. First-match-wins over
an ordered list keeps it O(rules) with no I/O, and the resource-pattern match is
string work, so the cost is bounded by policy size — one more reason rules are
data rather than a program.

The `require_review` decision couples policy to the review subsystem: a policy
can now create review load. Operators need to know that, so it is documented in
[[agent-integration]] and `ACP-SKILL.md` alongside the denial semantics.

## Alternatives

**Extending the `Permission` union with resource-scoped variants.** Rejected: a
closed v0.1 protocol vocabulary, so every addition breaks clients and the
OpenAPI contract, and the combinatorics of scope × resource are unbounded.

**Starlark, as codex uses.** Rejected: an embedded language runtime for
expressiveness ACP has no demonstrated need for. Effect Schema already covers
declarative shape validation, and hooks cover genuine computation.

**Boolean allow/deny.** Rejected: loses the middle case, which is the common one
in practice — the action is neither clearly safe nor clearly forbidden and wants
a human or agent judgment.

**Optional justifications.** Rejected: optional explanations are absent
explanations, and a refused autonomous agent with no reason retries forever.

**Implicit default-allow when no rule matches.** Rejected: silently permissive
policy engines are how misconfiguration becomes a breach. Explicit or nothing.

**Last-match-wins or specificity scoring.** Rejected: harder to predict by
reading the file, and specificity scoring makes the effect of adding a rule
non-local.

## Validation

Acceptance requires tests proving: policy narrows but never widens — an action
denied by permission stays denied whatever the policy says; each decision value
produces its documented outcome, with `require_review` landing in the existing
review flow; first-match-wins ordering holds and is unaffected by later
overlapping rules; a policy whose `match` example fails to resolve to its own
rule aborts load; a policy whose `notMatch` example does resolve aborts load; a
missing top-level `default` aborts load; an absent policy file leaves every
existing behavior and event payload unchanged; and a workspace overlay cannot
grant what the host policy denies.

Plus a dogfood script in which a worker is refused a lease on a protected path
and receives the rule's justification — and the full typecheck/lint/format/suite
gate.

## Grill Log

- **Q:** Why not just extend `Permission`? **A:** It is a closed protocol
  vocabulary fixed by spec §8; every addition is a client break, and scope ×
  resource does not enumerate. Layering keeps policy additive and
  non-escalating. _Rejected:_ resource-scoped permission variants.
- **Q:** Why drop Starlark when it is the source design's core? **A:** It buys
  computed rules at the price of an embedded interpreter. ACP decodes everything
  through Effect Schema already, and ADR-0022 hooks cover the computation case.
  _Rejected:_ an embedded policy language.
- **Q:** Is failing startup on a bad policy too aggressive? **A:** An access rule
  that silently stopped matching is the failure operators cannot see. Loud at
  boot beats silent in production, and it matches the ADR-0020 guard.
  _Rejected:_ load-with-warnings.
- **Q:** Why must the default be explicit? **A:** Either implicit choice is
  wrong for some operator, and a permissive guess is a security failure. Writing
  rules implies having considered the no-match case. _Rejected:_ implicit
  default-allow.

## Referenced by

[[00-INDEX]]
