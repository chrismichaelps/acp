---
type: design
status: DRAFT
date: 2026-08-08
tags: [design, cost, budget, accounting, control-plane]
aliases: [cost-budget-accounting, sub-project-a]
---

# Cost & Budget Accounting

Sub-project A of the ACP control-plane evolution. Makes token and compute spend
a protocol-level concept: recorded truthfully, priced by workspace policy, and
enforced at claim boundaries.

## Why this first

The control-plane vision decomposes into six independent sub-projects — cost
accounting (A), engine-as-workload (B), placement (C), a Kubernetes backend (D),
multi-tenancy quotas (E), and federation/observability (F). A goes first for one
reason: it is the only one that changes the protocol's data model, and
retrofitting cost fields into a protocol with live first-party clients is far
more expensive than adding them before those clients exist. C and E are
unbuildable without A's signal; B and D are additive at the adapter seam and can
follow.

## What already exists

This spec deliberately does not re-specify shipped work.

- [[ADR-0026-agent-sandbox-runtime]] owns container lifetime, resource limits,
  and the `SandboxProvider` port. The metered reporting path in this spec is a
  hook on that lifetime, not new infrastructure.
- [[ADR-0024-worker-identity-provenance]] owns `x-acp-assertion`. Attested cost
  reports are a fifth signed action, not a new identity mechanism.
- [[ADR-0021-work-unit-spawn-graph]] owns parent/child structure. Subtree
  rollup reuses that graph rather than introducing a second hierarchy.
- Feature 580 delivered version-CAS and indexed `queryBy` across all three
  store adapters. The rollup accumulator is built on those, not alongside them.

## Decisions

| Decision          | Choice                                             |
| ----------------- | -------------------------------------------------- |
| Ledger or control | Both — record always, enforce at claim boundaries  |
| Cost source       | Split: attested tokens + metered compute           |
| Unit of account   | Raw dimensioned ledger, price derived at read time |
| Budget scope      | Subtree rollup — child spend charges ancestors     |
| Storage shape     | Immutable entries + CAS-materialized rollup        |
| Event surface     | Two new event types; cost entries are not events   |

Each is stated with its rejected alternative in the sections below.

## Module layout

A new `src/domain/cost/`, following the shape `src/domain/sandbox/` set: the
decision logic is pure and asserted exhaustively without a store, and a thin
Effect service wires it to persistence.

| File                 | Responsibility                                     | Purity    |
| -------------------- | -------------------------------------------------- | --------- |
| `resource-usage.ts`  | Dimensioned quantity type and its addition         | pure      |
| `price-table.ts`     | `priceOf(usage, table) → MicroUsd \| Unpriced`     | pure      |
| `cost-rollup.ts`     | Rollup arithmetic; rebuild-from-entries            | pure      |
| `budget-decision.ts` | `decide(inclusiveTotal, budget) → Admit \| Refuse` | pure      |
| `cost-service.ts`    | Append entry, CAS ancestors, answer queries        | effectful |

Money- and denial-relevant logic sits in the pure column for the same reason
ADR-0026 made `toCreateContainerRequest` pure: the consequential cases can be
enumerated in tests without standing anything up.

## Protocol additions

New file `src/protocol/schema/cost.schema.ts`.

### `ResourceUsage`

The dimensioned truth, never a converted figure:

```
{
  model?: string
  input_tokens: number
  output_tokens: number
  cached_input_tokens: number
  cpu_seconds: number
  mib_seconds: number
}
```

Storing raw quantities rather than a priced scalar is what lets history be
re-priced as a read-time view instead of a migration, and lets spend be broken
down by model. The rejected alternative — engines reporting a single micro-USD
figure — is smaller, but makes ACP unable to audit or attribute what it charged.

### `CostEntry`

```
{
  entry_id: EntryId          // client-supplied, idempotent
  workspace_id: WorkspaceId
  work_id: WorkId
  worker_id?: WorkerId
  usage: ResourceUsage
  source: 'attested' | 'metered'
  recorded_at: Timestamp
}
```

Immutable once written. `source` is recorded rather than inferred so a consumer
can always distinguish a number ACP observed from one an engine asserted, and
so a future policy can weight them differently without a schema change.

`entry_id` is supplied by the caller and enforced unique per workspace. A
retrying engine must not double-charge; without idempotency the first network
retry silently corrupts every ancestor budget above it, and the corruption is
invisible because the ledger looks internally consistent.

### `Budget`

```
{ limit_micro_usd: number, set_by: WorkerId, set_at: Timestamp }
```

Attachable to a workspace or an individual work unit. **An absent budget means
unbounded.** Enforcement therefore needs no feature flag and is vacuous until an
operator opts in by setting one — existing deployments upgrade without any
behavioural change, which a default-on flag could not promise.

### `PriceTable`

Workspace-scoped: per-model token rates plus CPU-second and MiB-second rates.
Prices are policy, not protocol constants, and belong to the workspace for the
same reason [[ADR-0023-resource-access-policy]] put overlays there.

## Reporting paths

### Attested — engine-reported tokens

`POST /v1/work/:work_id/cost`, carrying `x-acp-assertion` per ADR-0024, binding
every attested entry to the worker identity that holds the claim.

ACP does not own the harness — ADR-0026 states this plainly — so it never
observes a model call and token counts can only be attested. This is a
limitation to be recorded honestly in `source`, not one to be papered over.

**Engines must aggregate.** Reports are periodic and batched, never per model
call. This is a protocol requirement rather than engine-author discretion,
because each report costs O(depth) CAS writes and a per-call reporter would
contend the root rollup out of service.

### Metered — ACP-observed compute

ACP writes these itself. `SandboxService` already owns container lifetime and
the configured CPU/memory limits, so on sandbox stop or delete it emits a
metered entry for wall-clock elapsed multiplied by those limits. No stats
stream is required, and the resulting number is unforgeable.

Metering the configured limit rather than actual consumption slightly
over-charges a sandbox that idles. That is the correct direction: the limit is
the capacity the platform reserved and could not give to anyone else.

## Enforcement

Three boundaries, all existing call sites:

1. `transition → claimed`
2. `transition → running`
3. sandbox provisioning

Each walks from the unit to the workspace root and evaluates **every** budget
found on the way, comparing each against the inclusive rollup of the unit that
carries it. **All of them must admit**; the first refusal denies. Stopping at
the nearest budget-carrying ancestor would let a generous inner budget override
a tighter outer one, which inverts the containment the rollup exists to provide.

Refusal is `ERR_BUDGET_EXHAUSTED` — an ordinary denial, shaped like a permission
failure, naming which unit's budget was exceeded.

**No new work state.** The rejected alternative added an `exhausted` state
beside `blocked`, which reads well in replay but grows a machine held
deliberately at nine states and drags in the spawn-graph gate and the
cancellation rules of [[ADR-0027-subtree-cancellation]] and
[[ADR-0028-cancelling-blocked-work]]. The refusal is legible enough from the
`budget.exhausted` event plus the error on the refused call.

Enforcement is at boundaries, not continuous: a unit already running past its
budget is not killed mid-flight. Work is refused entry, never interrupted.

### Subtree rollup

A budget on a unit bounds its entire subtree. This closes the hole where an
agent spawns children to escape its own limit — which would make the limit
advisory in exactly the case it most needs to bind.

### Unpriced models

An entry whose model has no price cannot be silently free, or a budget is
escaped by reporting an unknown model name.

- The entry is **always recorded.** Truth is never dropped.
- Reporting an unpriced model **while a budget applies** is
  `ERR_UNPRICED_MODEL`.
- With no budget in force, it is accepted and priced as unpriced.

## Storage

`CostEntry` rows are appends, indexed by `work_id` and by `entry_id` for the
uniqueness check.

The rollup is `{ own_micro_usd, inclusive_micro_usd, version }`, CAS-incremented
on the unit and each ancestor using the version-CAS from feature 580.

Because the rollup is derived, drift is repairable rather than permanent. The
**rebuild-from-entries path ships in this slice**, not later — it is the
property that makes denormalizing money defensible at all.

### Known risk: root CAS contention

A deep spawn graph with many chatty engines contends on the root's rollup row.
The batching requirement is the mitigation. If contention appears in practice,
the escape hatch is per-ancestor sharded counters summed on read — recorded here
as a known direction, deliberately not built today.

## Events

Two additions to `EventType`: `budget.exhausted` and `budget.granted`.

Cost entries never enter the event log. That union is a causal spine of
coordination facts; high-volume non-causal telemetry would drown it and every
SSE tail consumer with it. Only budget _decisions_ are causal.

## Testing

- **Pure core, exhaustive:** pricing across present/absent/zero rates; rollup
  arithmetic and rebuild equivalence; admit/refuse at, below, and above the
  limit; idempotent replay of a duplicate `entry_id`.
- **Service, over the in-memory store:** attested and metered append; ancestor
  CAS propagation; refusal at each of the three boundaries; unpriced-model
  behaviour with and without a budget in force.
- **Conformance:** none needed. The three new collections scope on
  `workspace_id` and `work_id`, both already in `INDEXED_FIELDS`, so no adapter
  gains a promoted column and `query-conformance.test.ts` is unchanged. Should a
  later slice need a new indexed field, that is when the conformance additions
  are owed.

## Out of scope

Quotas and priority classes (E), cost-aware placement (C), per-tenant billing
and invoicing, cross-workspace aggregation (F), and mid-flight interruption of
work that exceeds budget while running.

## Follow-on

Implementation opens as ADR-0030 under the wiki-first build loop, with the
protocol schema and pure core as the first vertical slice.
