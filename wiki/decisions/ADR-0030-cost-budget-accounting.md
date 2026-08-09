---
type: decision
status: ACCEPTED
date: 2026-08-08
tags: [adr, accepted, cost, budgets, accounting, protocol]
aliases: [ADR-0030, cost-budget-accounting]
---

# ADR-0030 — Cost and Budget Accounting

## Status

ACCEPTED — implemented.

Delivered: dimensioned token and compute entries; workspace price tables;
CAS-maintained own and subtree rollups; work-unit budgets; admission checks at
claim, running, and sandbox-provisioning boundaries; sandbox lifetime metering;
budget decision events; and authenticated REST routes for reporting, reading,
budgeting, and pricing.

## Context

ACP coordinated work without accounting for the resources that work consumed.
Engines could report tokens, and the sandbox adapter observed execution
lifetime, but neither became durable protocol data. Operators therefore could
not attribute spend to a work unit, bound the spend of a spawned subtree, or
refuse new execution after a limit was consumed.

The accounting boundary must preserve raw observations. Token and compute
quantities outlive a particular price table, while prices are workspace policy
that can change independently. Enforcement must also remain cheap at admission:
scanning every descendant whenever a worker claims a unit would make the root
of a large spawn graph the most expensive place to ask a yes-or-no question.

## Decision

### Entries are immutable, dimensioned facts

Each caller supplies an idempotency key. ACP records model/token quantities,
CPU seconds, MiB-seconds, source, worker attribution, and timestamp without
embedding a converted monetary value. Attested HTTP reports require a
`cost.report` worker assertion; sandbox compute is recorded as metered usage.

### Pricing is workspace policy

A workspace price table converts dimensions into integer micro-USD. Prices are
not stored on entries, so rebuilding a rollup under a changed table re-prices
the surviving history without rewriting the ledger. An unknown model is
accepted as unpriced while no budget applies and refused with `unpriced_model`
when accepting it would let a caller escape a budget.

### Rollups make admission bounded

Every report CAS-increments the unit's own and inclusive totals and the
inclusive total of each ancestor. A budget applies to the complete subtree of
the unit that carries it. Admission evaluates every budget from the target unit
outward; equality with the limit is exhausted and returns `budget_exhausted`.

The raw entries remain authoritative. `rebuild` restates a unit's own spend and
preserves descendant spend already present in its inclusive accumulator.

### Enforcement happens only at entry boundaries

Claims, transitions into `running`, and sandbox provisioning check admission.
Running work is never interrupted when a later report consumes the remaining
budget. Refusals emit `budget.exhausted`; grants emit `budget.granted`.

## Rejected Alternatives

**Add an `exhausted` work state.** Rejected: exhaustion is a refusal at an
execution boundary, not a lifecycle state. Adding it would enlarge the work
state machine and entangle cancellation and child-completion rules without
improving enforcement.

**Write cost entries into the event log.** Rejected: cost samples are telemetry,
not causal coordination facts. The append-only event spine remains small enough
for replay; only budget grants and refusals enter it.

**Store converted prices on entries.** Rejected: that would bind historical
facts to mutable policy and require rewriting the ledger to re-price it.

**Include Kubernetes orchestration.** Rejected: Kubernetes is out of scope;
this slice is protocol and domain only. The existing sandbox provider remains
the execution seam.

## Consequences

Reporting spend performs O(depth) CAS writes, while admission performs one
rollup read for each budget-carrying unit on the ancestor path. Engines must
aggregate reports rather than submit one entry per model call.

Known risk: **root CAS contention** under a deep spawn graph with chatty
engines, mitigated by the aggregate-reporting requirement, with per-ancestor
sharded counters as the deliberately unbuilt escape hatch.

The cost ledger is idempotent but rollup propagation spans multiple rows rather
than a transaction. A crash can under-count an ancestor; rebuilding from the
immutable entries is the repair path.

## References

- [[cost-budget-accounting]]
- [[ADR-0024-worker-identity-provenance]]
- [[ADR-0026-agent-sandbox-runtime]]
