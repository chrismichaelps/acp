---
type: plan
status: READY
date: 2026-08-08
tags: [plan, cost, budget, accounting, control-plane]
aliases: [cost-budget-accounting-plan]
---

# Cost & Budget Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make token and compute spend a protocol-level concept in ACP — recorded as a raw dimensioned ledger, priced by workspace policy at read time, rolled up through the spawn graph, and enforced at claim boundaries.

**Architecture:** A new `src/domain/cost/` holding four pure modules (usage arithmetic, pricing, rollup arithmetic, budget decision) and one Effect service that wires them to the `Storage` seam. Cost entries are immutable appends keyed by a caller-supplied `entry_id`; a derived `CostRollup` row per work unit is CAS-incremented on the unit and each ancestor via `replaceIfVersion`, so a claim-time budget check is one read rather than a subtree scan. Enforcement refuses transitions; it never interrupts running work, and adds no new work state.

**Tech Stack:** TypeScript, Effect (Schema, Context, Layer, Option), `@effect/platform` HttpApi, vitest, SQLite/Postgres/in-memory storage adapters.

Design of record: [[cost-budget-accounting]]. This plan implements it in full.

## Global Constraints

- **Source files must stay at or below 500 lines.** Enforced by `pnpm check:file-size`. Split before you exceed it.
- **Prettier gates all markdown and TypeScript.** Run `node_modules/.bin/prettier --write <files>` before every commit; CI runs `format:check` over the whole repo.
- **Run tooling through `node_modules/.bin/`, with `/opt/homebrew/bin` first on `PATH`.** `npm` is blocked by `devEngines: pnpm`, and vitest/rolldown crashes under the x64 Rosetta node. Prefix commands with `PATH=/opt/homebrew/bin:$PATH`.
- **No new npm dependencies.** Installs are blocked in this environment; everything here uses packages already present.
- **Every module opens with an `/** @Acp.<Path> — <purpose> */` header comment**, matching every existing file in `src/`.
- **Money- and denial-relevant logic must be pure**, in the modules named below, and asserted without a store — the precedent is `toCreateContainerRequest` in [[ADR-0026-agent-sandbox-runtime]].
- **`Option` for optional fields, never `null` or `undefined`**, following `src/protocol/schema/*.ts`.
- **Commit messages must not carry Claude attribution.**

## File Structure

| Path                                                | Responsibility                                                     | Task |
| --------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| `src/protocol/schema/ids.ts`                        | add `CostEntryId` brand                                            | 1    |
| `src/protocol/schema/cost.schema.ts`                | `ResourceUsage`, `CostEntry`, `Budget`, `PriceTable`, `CostRollup` | 1    |
| `src/protocol/schema/error.schema.ts`               | add `budget_exhausted`, `unpriced_model` codes                     | 1    |
| `src/protocol/errors/protocol-error.ts`             | `BudgetExhaustedError`, `UnpricedModelError`                       | 1    |
| `src/protocol/schema/event.schema.ts`               | add `budget.exhausted`, `budget.granted`                           | 1    |
| `src/domain/cost/resource-usage.ts`                 | dimensioned quantity type + addition                               | 2    |
| `src/domain/cost/price-table.ts`                    | `priceOf(usage, table)`                                            | 3    |
| `src/domain/cost/cost-rollup.ts`                    | rollup arithmetic + rebuild                                        | 4    |
| `src/domain/cost/budget-decision.ts`                | `decide(path)`                                                     | 5    |
| `src/domain/cost/cost-service.ts`                   | append, CAS ancestors, admission check                             | 6, 7 |
| `src/domain/cost/index.ts`                          | barrel                                                             | 6    |
| `src/domain/work-units/work-unit-service.ts`        | admission check on `claimed` / `running`                           | 8    |
| `src/domain/sandbox/sandbox-service.ts`             | admission check + metered entry on stop                            | 9    |
| `src/infrastructure/http/acp-http-api-cost.ts`      | HTTP contract for cost, budgets, prices                            | 10   |
| `wiki/decisions/ADR-0030-cost-budget-accounting.md` | the decision record                                                | 11   |

---

### Task 1: Protocol schema, errors, and events

**Files:**

- Create: `src/protocol/schema/cost.schema.ts`
- Create: `src/protocol/schema/cost.schema.test.ts`
- Modify: `src/protocol/schema/ids.ts`
- Modify: `src/protocol/schema/error.schema.ts`
- Modify: `src/protocol/schema/event.schema.ts`
- Modify: `src/protocol/schema/index.ts`
- Modify: `src/protocol/errors/protocol-error.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `CostEntryId`, `ResourceUsage`, `CostSource`, `CostEntry`, `ModelPrice`, `PriceTable`, `Budget`, `CostRollup` (all from `src/protocol/schema/index.js`); `BudgetExhaustedError`, `UnpricedModelError` (from `src/protocol/errors/protocol-error.js`); event types `'budget.exhausted'` and `'budget.granted'`.

- [ ] **Step 1: Write the failing test**

Create `src/protocol/schema/cost.schema.test.ts`:

```ts
/** @Acp.Protocol.Cost.Test — cost schema round-trips */
import { describe, expect, it } from 'vitest'
import { Option, Schema } from 'effect'
import { CostEntry, ResourceUsage } from './cost.schema.js'

describe('cost schema', () => {
  it('round-trips an attested entry with a model', () => {
    const decoded = Schema.decodeUnknownSync(CostEntry)({
      entry_id: 'cost_1',
      workspace_id: 'workspace_1',
      work_id: 'work_1',
      worker_id: 'agent_a',
      usage: {
        model: 'claude-opus-5',
        input_tokens: 1000,
        output_tokens: 200,
        cached_input_tokens: 0,
        cpu_seconds: 0,
        mib_seconds: 0,
      },
      source: 'attested',
      recorded_at: '2026-08-08T10:00:00Z',
    })
    expect(decoded.source).toBe('attested')
    expect(Option.getOrNull(decoded.usage.model)).toBe('claude-opus-5')
  })

  it('round-trips a metered entry with no model', () => {
    const decoded = Schema.decodeUnknownSync(ResourceUsage)({
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
      cpu_seconds: 30,
      mib_seconds: 61440,
    })
    expect(Option.isNone(decoded.model)).toBe(true)
  })

  it('rejects a negative token count', () => {
    expect(() =>
      Schema.decodeUnknownSync(ResourceUsage)({
        input_tokens: -1,
        output_tokens: 0,
        cached_input_tokens: 0,
        cpu_seconds: 0,
        mib_seconds: 0,
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/protocol/schema/cost.schema.test.ts`
Expected: FAIL — `Failed to resolve import "./cost.schema.js"`.

- [ ] **Step 3: Add the `CostEntryId` brand**

In `src/protocol/schema/ids.ts`, append after `SessionId`:

```ts
export const CostEntryId = Schema.String.pipe(Schema.brand('CostEntryId'))
export type CostEntryId = typeof CostEntryId.Type
```

- [ ] **Step 4: Create the cost schema**

Create `src/protocol/schema/cost.schema.ts`:

```ts
/** @Acp.Protocol.Cost — dimensioned spend, pricing policy, and budgets */
import { Schema } from 'effect'
import { CostEntryId, WorkId, WorkerId, WorkspaceId } from './ids.js'
import { Timestamp } from './common.js'

const NonNegative = Schema.Number.pipe(Schema.nonNegative())

/**
 * Raw dimensioned spend — never a converted figure. Storing quantities rather
 * than a priced scalar is what lets history be re-priced as a read-time view
 * instead of a migration. See [[cost-budget-accounting]].
 */
export const ResourceUsage = Schema.Struct({
  model: Schema.optionalWith(Schema.NonEmptyString, {
    as: 'Option',
    nullable: true,
  }),
  input_tokens: NonNegative,
  output_tokens: NonNegative,
  cached_input_tokens: NonNegative,
  cpu_seconds: NonNegative,
  mib_seconds: NonNegative,
})
export type ResourceUsage = typeof ResourceUsage.Type

/**
 * Recorded rather than inferred, so a consumer can always tell a number ACP
 * observed from one an engine asserted. ACP does not own the harness
 * ([[ADR-0026-agent-sandbox-runtime]]), so tokens can only ever be attested.
 */
export const CostSource = Schema.Literal('attested', 'metered')
export type CostSource = typeof CostSource.Type

export const CostEntry = Schema.Struct({
  entry_id: CostEntryId,
  workspace_id: WorkspaceId,
  work_id: WorkId,
  worker_id: Schema.optionalWith(WorkerId, { as: 'Option', nullable: true }),
  usage: ResourceUsage,
  source: CostSource,
  recorded_at: Timestamp,
})
export type CostEntry = typeof CostEntry.Type

export const ModelPrice = Schema.Struct({
  input_micro_usd_per_token: NonNegative,
  output_micro_usd_per_token: NonNegative,
  cached_input_micro_usd_per_token: NonNegative,
})
export type ModelPrice = typeof ModelPrice.Type

/** Prices are workspace policy, not protocol constants. */
export const PriceTable = Schema.Struct({
  workspace_id: WorkspaceId,
  models: Schema.Record({ key: Schema.String, value: ModelPrice }),
  cpu_micro_usd_per_second: NonNegative,
  mib_micro_usd_per_second: NonNegative,
  updated_at: Timestamp,
})
export type PriceTable = typeof PriceTable.Type

/** An absent budget means unbounded — enforcement needs no feature flag. */
export const Budget = Schema.Struct({
  limit_micro_usd: NonNegative,
  set_by: WorkerId,
  set_at: Timestamp,
})
export type Budget = typeof Budget.Type

/**
 * Derived from the entries, never authoritative over them. The row's CAS
 * version lives in `StoredRecord.version`, not here, so the accumulator can be
 * rebuilt without inventing a second version counter.
 */
export const CostRollup = Schema.Struct({
  work_id: WorkId,
  workspace_id: WorkspaceId,
  own_micro_usd: NonNegative,
  inclusive_micro_usd: NonNegative,
  budget: Schema.optionalWith(Budget, { as: 'Option', nullable: true }),
})
export type CostRollup = typeof CostRollup.Type
```

- [ ] **Step 5: Export from the schema barrel**

In `src/protocol/schema/index.ts`, add alongside the other `export *` lines:

```ts
export * from './cost.schema.js'
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/protocol/schema/cost.schema.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 7: Add the error codes**

In `src/protocol/schema/error.schema.ts`, add two members to `ErrorCode`, after `'lease_conflict'`:

```ts
  'budget_exhausted',
  'unpriced_model',
```

- [ ] **Step 8: Add the tagged errors**

In `src/protocol/errors/protocol-error.ts`, add after `DepthLimitExceededError`:

```ts
/**
 * A budget on the path from this work unit to the workspace root is spent.
 * Names the unit whose budget was exceeded, because with subtree rollup the
 * refused unit and the budget-carrying unit are usually different.
 */
export class BudgetExhaustedError extends Data.TaggedError(
  'BudgetExhaustedError',
)<{
  readonly workId: string
  readonly budgetWorkId: string
  readonly limitMicroUsd: number
  readonly inclusiveMicroUsd: number
}> {}

/**
 * A cost report named a model with no price while a budget was in force.
 * Refusing here is what stops a budget being escaped by reporting spend under
 * an unknown model name; with no budget in force the report is accepted.
 */
export class UnpricedModelError extends Data.TaggedError('UnpricedModelError')<{
  readonly workId: string
  readonly model: string
}> {}
```

- [ ] **Step 9: Map the errors to protocol codes**

In the same file, find the function mapping tagged errors to `ErrorCode` (it matches on `_tag`) and add two cases, mirroring the surrounding style:

```ts
    case 'BudgetExhaustedError':
      return 'budget_exhausted'
    case 'UnpricedModelError':
      return 'unpriced_model'
```

- [ ] **Step 10: Add the two event types**

In `src/protocol/schema/event.schema.ts`, add to the `EventType` literal after `'grill.failed'`:

```ts
  'budget.granted',
  'budget.exhausted',
```

Cost entries deliberately do **not** get an event type: that union is a causal spine of coordination facts, and high-volume telemetry would drown it and every SSE tail consumer.

- [ ] **Step 11: Run the full suite and the gates**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run`
Expected: PASS, with no new failures. Some tests assert the exact `EventType` and `ErrorCode` membership — if any fail, update those fixtures to include the new members; that is the intended change, not a regression.

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsc --noEmit`
Expected: no output.

- [ ] **Step 12: Commit**

```bash
node_modules/.bin/prettier --write src/protocol && git add src/protocol && git commit -m "feat(protocol): cost, budget and price-table schema"
```

---

### Task 2: Pure — resource usage arithmetic

**Files:**

- Create: `src/domain/cost/resource-usage.ts`
- Create: `src/domain/cost/resource-usage.test.ts`

**Interfaces:**

- Consumes: `ResourceUsage` from Task 1.
- Produces: `zeroUsage: ResourceUsage`, `addUsage: (left: ResourceUsage, right: ResourceUsage) => ResourceUsage`, `hasTokens: (usage: ResourceUsage) => boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/cost/resource-usage.test.ts`:

```ts
/** @Acp.Domain.Cost.ResourceUsage.Test — dimensioned addition */
import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import type { ResourceUsage } from '../../protocol/schema/index.js'
import { addUsage, hasTokens, zeroUsage } from './resource-usage.js'

const usage = (over: Partial<ResourceUsage>): ResourceUsage => ({
  ...zeroUsage,
  ...over,
})

describe('addUsage', () => {
  it('adds each dimension independently', () => {
    const sum = addUsage(
      usage({ input_tokens: 10, cpu_seconds: 2 }),
      usage({ input_tokens: 5, mib_seconds: 100 }),
    )
    expect(sum.input_tokens).toBe(15)
    expect(sum.cpu_seconds).toBe(2)
    expect(sum.mib_seconds).toBe(100)
  })

  it('drops the model, because a sum spans models', () => {
    const sum = addUsage(
      usage({ model: Option.some('claude-opus-5'), input_tokens: 1 }),
      usage({ model: Option.some('claude-opus-5'), input_tokens: 1 }),
    )
    expect(Option.isNone(sum.model)).toBe(true)
  })

  it('treats zeroUsage as the identity', () => {
    const one = usage({ output_tokens: 7, model: Option.some('m') })
    expect(addUsage(one, zeroUsage).output_tokens).toBe(7)
  })
})

describe('hasTokens', () => {
  it('is false for pure compute', () => {
    expect(hasTokens(usage({ cpu_seconds: 10 }))).toBe(false)
  })

  it('is true when any token dimension is non-zero', () => {
    expect(hasTokens(usage({ cached_input_tokens: 1 }))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/resource-usage.test.ts`
Expected: FAIL — cannot resolve `./resource-usage.js`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/cost/resource-usage.ts`:

```ts
/** @Acp.Domain.Cost.ResourceUsage — dimensioned spend and its addition */
import { Option } from 'effect'
import type { ResourceUsage } from '../../protocol/schema/index.js'

export const zeroUsage: ResourceUsage = {
  model: Option.none(),
  input_tokens: 0,
  output_tokens: 0,
  cached_input_tokens: 0,
  cpu_seconds: 0,
  mib_seconds: 0,
}

/**
 * Adds two usages dimension by dimension. The model is deliberately dropped:
 * a sum spans models, and carrying one of the two operands' names forward
 * would make an aggregate look like it were priceable at a single rate.
 */
export const addUsage = (
  left: ResourceUsage,
  right: ResourceUsage,
): ResourceUsage => ({
  model: Option.none(),
  input_tokens: left.input_tokens + right.input_tokens,
  output_tokens: left.output_tokens + right.output_tokens,
  cached_input_tokens: left.cached_input_tokens + right.cached_input_tokens,
  cpu_seconds: left.cpu_seconds + right.cpu_seconds,
  mib_seconds: left.mib_seconds + right.mib_seconds,
})

/** True when any token dimension is non-zero, so pricing needs a model. */
export const hasTokens = (usage: ResourceUsage): boolean =>
  usage.input_tokens > 0 ||
  usage.output_tokens > 0 ||
  usage.cached_input_tokens > 0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/resource-usage.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
node_modules/.bin/prettier --write src/domain/cost && git add src/domain/cost && git commit -m "feat(cost): dimensioned resource usage arithmetic"
```

---

### Task 3: Pure — pricing

**Files:**

- Create: `src/domain/cost/price-table.ts`
- Create: `src/domain/cost/price-table.test.ts`

**Interfaces:**

- Consumes: `ResourceUsage`, `PriceTable` from Task 1; `hasTokens` from Task 2.
- Produces: `type PriceResult = { readonly _tag: 'Priced'; readonly micro_usd: number } | { readonly _tag: 'Unpriced'; readonly model: string }` and `priceOf: (usage: ResourceUsage, table: PriceTable) => PriceResult`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/cost/price-table.test.ts`:

```ts
/** @Acp.Domain.Cost.PriceTable.Test — usage priced by workspace policy */
import { describe, expect, it } from 'vitest'
import { Option, Schema } from 'effect'
import { Timestamp, WorkspaceId } from '../../protocol/schema/index.js'
import type { PriceTable, ResourceUsage } from '../../protocol/schema/index.js'
import { priceOf } from './price-table.js'
import { zeroUsage } from './resource-usage.js'

const table: PriceTable = {
  workspace_id: Schema.decodeUnknownSync(WorkspaceId)('workspace_1'),
  models: {
    'claude-opus-5': {
      input_micro_usd_per_token: 15,
      output_micro_usd_per_token: 75,
      cached_input_micro_usd_per_token: 2,
    },
  },
  cpu_micro_usd_per_second: 10,
  mib_micro_usd_per_second: 1,
  updated_at: Schema.decodeUnknownSync(Timestamp)('2026-08-08T10:00:00Z'),
}

const usage = (over: Partial<ResourceUsage>): ResourceUsage => ({
  ...zeroUsage,
  ...over,
})

describe('priceOf', () => {
  it('prices tokens at the named model rate', () => {
    const result = priceOf(
      usage({
        model: Option.some('claude-opus-5'),
        input_tokens: 100,
        output_tokens: 10,
        cached_input_tokens: 50,
      }),
      table,
    )
    // 100*15 + 10*75 + 50*2 = 1500 + 750 + 100
    expect(result).toEqual({ _tag: 'Priced', micro_usd: 2350 })
  })

  it('prices compute with no model named', () => {
    const result = priceOf(usage({ cpu_seconds: 3, mib_seconds: 20 }), table)
    expect(result).toEqual({ _tag: 'Priced', micro_usd: 50 })
  })

  it('adds compute to token cost in a single entry', () => {
    const result = priceOf(
      usage({
        model: Option.some('claude-opus-5'),
        input_tokens: 1,
        cpu_seconds: 1,
      }),
      table,
    )
    expect(result).toEqual({ _tag: 'Priced', micro_usd: 25 })
  })

  it('refuses an unknown model', () => {
    const result = priceOf(
      usage({ model: Option.some('mystery-model'), input_tokens: 1 }),
      table,
    )
    expect(result).toEqual({ _tag: 'Unpriced', model: 'mystery-model' })
  })

  it('refuses tokens reported with no model at all', () => {
    // Otherwise a budget is escaped by omitting the model field entirely.
    const result = priceOf(usage({ input_tokens: 1_000_000 }), table)
    expect(result).toEqual({ _tag: 'Unpriced', model: '<unnamed>' })
  })

  it('prices an empty usage as zero', () => {
    expect(priceOf(zeroUsage, table)).toEqual({ _tag: 'Priced', micro_usd: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/price-table.test.ts`
Expected: FAIL — cannot resolve `./price-table.js`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/cost/price-table.ts`:

```ts
/** @Acp.Domain.Cost.PriceTable — usage priced by workspace policy */
import { Option } from 'effect'
import type { PriceTable, ResourceUsage } from '../../protocol/schema/index.js'
import { hasTokens } from './resource-usage.js'

export type PriceResult =
  | { readonly _tag: 'Priced'; readonly micro_usd: number }
  | { readonly _tag: 'Unpriced'; readonly model: string }

/** Stands in for a model name when tokens are reported without one. */
export const UNNAMED_MODEL = '<unnamed>'

const priced = (micro_usd: number): PriceResult => ({
  _tag: 'Priced',
  micro_usd,
})

const computeCost = (usage: ResourceUsage, table: PriceTable): number =>
  usage.cpu_seconds * table.cpu_micro_usd_per_second +
  usage.mib_seconds * table.mib_micro_usd_per_second

/**
 * Prices one usage. Compute always prices — its rates are workspace-wide.
 * Tokens price only against a named, known model: reporting tokens under an
 * unknown name, or under no name at all, would otherwise be a free channel
 * straight past any budget.
 */
export const priceOf = (
  usage: ResourceUsage,
  table: PriceTable,
): PriceResult => {
  const compute = computeCost(usage, table)
  if (!hasTokens(usage)) return priced(compute)

  const model = Option.getOrUndefined(usage.model)
  if (model === undefined) return { _tag: 'Unpriced', model: UNNAMED_MODEL }

  const rates = Object.prototype.hasOwnProperty.call(table.models, model)
    ? table.models[model]
    : undefined
  if (rates === undefined) return { _tag: 'Unpriced', model }

  return priced(
    compute +
      usage.input_tokens * rates.input_micro_usd_per_token +
      usage.output_tokens * rates.output_micro_usd_per_token +
      usage.cached_input_tokens * rates.cached_input_micro_usd_per_token,
  )
}
```

The `hasOwnProperty` guard matters: `table.models` is decoded from a `Schema.Record`, and a model literally named `constructor` would otherwise resolve to a prototype member rather than a rate.

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/price-table.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
node_modules/.bin/prettier --write src/domain/cost && git add src/domain/cost && git commit -m "feat(cost): price usage against a workspace price table"
```

---

### Task 4: Pure — rollup arithmetic

**Files:**

- Create: `src/domain/cost/cost-rollup.ts`
- Create: `src/domain/cost/cost-rollup.test.ts`

**Interfaces:**

- Consumes: `CostRollup`, `WorkId`, `WorkspaceId` from Task 1.
- Produces: `emptyRollup: (workId: WorkId, workspaceId: WorkspaceId) => CostRollup`, `applyOwn: (rollup: CostRollup, deltaMicroUsd: number) => CostRollup`, `applyDescendant: (rollup: CostRollup, deltaMicroUsd: number) => CostRollup`, `rebuildOwn: (rollup: CostRollup, entryPrices: readonly number[]) => CostRollup`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/cost/cost-rollup.test.ts`:

```ts
/** @Acp.Domain.Cost.Rollup.Test — own vs inclusive accumulation */
import { describe, expect, it } from 'vitest'
import { Option, Schema } from 'effect'
import { WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import {
  applyDescendant,
  applyOwn,
  emptyRollup,
  rebuildOwn,
} from './cost-rollup.js'

const workId = Schema.decodeUnknownSync(WorkId)('work_1')
const workspaceId = Schema.decodeUnknownSync(WorkspaceId)('workspace_1')
const base = emptyRollup(workId, workspaceId)

describe('cost rollup', () => {
  it('starts at zero with no budget', () => {
    expect(base.own_micro_usd).toBe(0)
    expect(base.inclusive_micro_usd).toBe(0)
    expect(Option.isNone(base.budget)).toBe(true)
  })

  it('applyOwn raises both own and inclusive', () => {
    const next = applyOwn(base, 500)
    expect(next.own_micro_usd).toBe(500)
    expect(next.inclusive_micro_usd).toBe(500)
  })

  it('applyDescendant raises only inclusive', () => {
    const next = applyDescendant(applyOwn(base, 500), 300)
    expect(next.own_micro_usd).toBe(500)
    expect(next.inclusive_micro_usd).toBe(800)
  })

  it('rebuildOwn restates own from entries and repairs inclusive by the same delta', () => {
    // Inclusive carries 400 of descendant spend; a rebuild must preserve it.
    const drifted = applyDescendant(applyOwn(base, 999), 400)
    const repaired = rebuildOwn(drifted, [100, 200])
    expect(repaired.own_micro_usd).toBe(300)
    expect(repaired.inclusive_micro_usd).toBe(700)
  })

  it('rebuildOwn on an empty entry list zeroes own spend', () => {
    const repaired = rebuildOwn(applyOwn(base, 50), [])
    expect(repaired.own_micro_usd).toBe(0)
    expect(repaired.inclusive_micro_usd).toBe(0)
  })

  it('preserves the budget across every operation', () => {
    const withBudget: CostRollup = {
      ...base,
      budget: Option.some({
        limit_micro_usd: 10,
        set_by: Schema.decodeUnknownSync(WorkerId)('agent_a'),
        set_at: Schema.decodeUnknownSync(Timestamp)('2026-08-08T10:00:00Z'),
      }),
    }
    expect(Option.isSome(applyOwn(withBudget, 1).budget)).toBe(true)
    expect(Option.isSome(applyDescendant(withBudget, 1).budget)).toBe(true)
    expect(Option.isSome(rebuildOwn(withBudget, [1]).budget)).toBe(true)
  })
})
```

The imports for this file are:

```ts
import {
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import type { CostRollup } from '../../protocol/schema/index.js'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/cost-rollup.test.ts`
Expected: FAIL — cannot resolve `./cost-rollup.js`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/cost/cost-rollup.ts`:

```ts
/** @Acp.Domain.Cost.Rollup — derived own/inclusive spend accumulators */
import { Option } from 'effect'
import type {
  CostRollup,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

export const emptyRollup = (
  workId: WorkId,
  workspaceId: WorkspaceId,
): CostRollup => ({
  work_id: workId,
  workspace_id: workspaceId,
  own_micro_usd: 0,
  inclusive_micro_usd: 0,
  budget: Option.none(),
})

/** Spend by this unit itself: raises both counters. */
export const applyOwn = (
  rollup: CostRollup,
  deltaMicroUsd: number,
): CostRollup => ({
  ...rollup,
  own_micro_usd: rollup.own_micro_usd + deltaMicroUsd,
  inclusive_micro_usd: rollup.inclusive_micro_usd + deltaMicroUsd,
})

/** Spend by a descendant: raises only the subtree total. */
export const applyDescendant = (
  rollup: CostRollup,
  deltaMicroUsd: number,
): CostRollup => ({
  ...rollup,
  inclusive_micro_usd: rollup.inclusive_micro_usd + deltaMicroUsd,
})

/**
 * Restates `own` from the entries that are the source of truth, and shifts
 * `inclusive` by the same delta so descendant spend already folded in survives
 * the repair. This is the path that makes denormalising money defensible: a
 * drifted accumulator is repairable rather than permanently wrong.
 */
export const rebuildOwn = (
  rollup: CostRollup,
  entryPrices: readonly number[],
): CostRollup => {
  const own = entryPrices.reduce((total, price) => total + price, 0)
  return {
    ...rollup,
    own_micro_usd: own,
    inclusive_micro_usd:
      rollup.inclusive_micro_usd - rollup.own_micro_usd + own,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/cost-rollup.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
node_modules/.bin/prettier --write src/domain/cost && git add src/domain/cost && git commit -m "feat(cost): own and inclusive rollup arithmetic with rebuild"
```

---

### Task 5: Pure — the budget decision

**Files:**

- Create: `src/domain/cost/budget-decision.ts`
- Create: `src/domain/cost/budget-decision.test.ts`

**Interfaces:**

- Consumes: `WorkId` from Task 1.
- Produces:

```ts
export interface BudgetOnPath {
  readonly work_id: WorkId
  readonly limit_micro_usd: number
  readonly inclusive_micro_usd: number
}
export type Decision =
  | { readonly _tag: 'Admit' }
  | {
      readonly _tag: 'Refuse'
      readonly work_id: WorkId
      readonly limit_micro_usd: number
      readonly inclusive_micro_usd: number
    }
export const decide: (path: readonly BudgetOnPath[]) => Decision
```

- [ ] **Step 1: Write the failing test**

Create `src/domain/cost/budget-decision.test.ts`:

```ts
/** @Acp.Domain.Cost.BudgetDecision.Test — every budget on the path must admit */
import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { WorkId } from '../../protocol/schema/index.js'
import { decide } from './budget-decision.js'

const child = Schema.decodeUnknownSync(WorkId)('work_child')
const root = Schema.decodeUnknownSync(WorkId)('work_root')

describe('decide', () => {
  it('admits when no budget is on the path', () => {
    expect(decide([])).toEqual({ _tag: 'Admit' })
  })

  it('admits when spend is below every limit', () => {
    expect(
      decide([
        { work_id: child, limit_micro_usd: 100, inclusive_micro_usd: 40 },
        { work_id: root, limit_micro_usd: 500, inclusive_micro_usd: 300 },
      ]),
    ).toEqual({ _tag: 'Admit' })
  })

  it('refuses at exactly the limit — a spent budget is exhausted', () => {
    expect(
      decide([
        { work_id: child, limit_micro_usd: 100, inclusive_micro_usd: 100 },
      ]),
    ).toEqual({
      _tag: 'Refuse',
      work_id: child,
      limit_micro_usd: 100,
      inclusive_micro_usd: 100,
    })
  })

  it('refuses on an outer budget even when the inner one is generous', () => {
    // A generous inner budget must not override a tighter outer one, or the
    // containment that subtree rollup exists to provide is inverted.
    expect(
      decide([
        { work_id: child, limit_micro_usd: 1_000_000, inclusive_micro_usd: 40 },
        { work_id: root, limit_micro_usd: 500, inclusive_micro_usd: 900 },
      ]),
    ).toEqual({
      _tag: 'Refuse',
      work_id: root,
      limit_micro_usd: 500,
      inclusive_micro_usd: 900,
    })
  })

  it('reports the nearest refusal first when several are exhausted', () => {
    const result = decide([
      { work_id: child, limit_micro_usd: 10, inclusive_micro_usd: 20 },
      { work_id: root, limit_micro_usd: 30, inclusive_micro_usd: 40 },
    ])
    expect(result).toMatchObject({ _tag: 'Refuse', work_id: child })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/budget-decision.test.ts`
Expected: FAIL — cannot resolve `./budget-decision.js`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/cost/budget-decision.ts`:

```ts
/** @Acp.Domain.Cost.BudgetDecision — admission against every budget on the path */
import type { WorkId } from '../../protocol/schema/index.js'

export interface BudgetOnPath {
  readonly work_id: WorkId
  readonly limit_micro_usd: number
  readonly inclusive_micro_usd: number
}

export type Decision =
  | { readonly _tag: 'Admit' }
  | {
      readonly _tag: 'Refuse'
      readonly work_id: WorkId
      readonly limit_micro_usd: number
      readonly inclusive_micro_usd: number
    }

const admit: Decision = { _tag: 'Admit' }

/**
 * `path` runs from the unit outward to the workspace root, and **every** budget
 * on it must admit. Stopping at the nearest budget-carrying ancestor would let
 * a generous inner budget override a tighter outer one.
 *
 * Exhaustion is `>=`: spend equal to the limit has consumed the budget.
 */
export const decide = (path: readonly BudgetOnPath[]): Decision => {
  for (const budget of path) {
    if (budget.inclusive_micro_usd >= budget.limit_micro_usd) {
      return {
        _tag: 'Refuse',
        work_id: budget.work_id,
        limit_micro_usd: budget.limit_micro_usd,
        inclusive_micro_usd: budget.inclusive_micro_usd,
      }
    }
  }
  return admit
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/budget-decision.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
node_modules/.bin/prettier --write src/domain/cost && git add src/domain/cost && git commit -m "feat(cost): budget admission decision over the ancestor path"
```

---

### Task 6: CostService — append entries and propagate the rollup

**Files:**

- Create: `src/domain/cost/cost-service.ts`
- Create: `src/domain/cost/cost-service.test.ts`
- Create: `src/domain/cost/index.ts`

**Interfaces:**

- Consumes: everything from Tasks 1–5; `Storage` (`src/infrastructure/storage/storage.js`), `WorkUnitService` (`src/domain/work-units/index.js`).
- Produces:

```ts
export interface ReportCostInput {
  readonly entry_id: CostEntryId
  readonly work_id: WorkId
  readonly worker_id: Option.Option<WorkerId>
  readonly usage: ResourceUsage
  readonly source: CostSource
  readonly now: Timestamp
}
export interface CostServiceApi {
  readonly report: (input: ReportCostInput) => Effect.Effect<CostEntry, CostServiceError>
  readonly rollupOf: (workId: WorkId) => Effect.Effect<CostRollup, CostServiceError>
  readonly rebuild: (workId: WorkId) => Effect.Effect<CostRollup, CostServiceError>
}
export class CostService extends Context.Tag('CostService')<CostService, CostServiceApi>() {}
export const CostServiceLive: Layer.Layer<CostService, never, Storage | WorkUnitService | ...>
```

**Collections:** `cost_entries` keyed by `entry_id`, `cost_rollups` keyed by `work_id`, `price_tables` keyed by `workspace_id`. All three scope on `workspace_id` and `work_id`, which are already in `INDEXED_FIELDS` — **no change to `index-columns.ts` is needed**, and none should be made.

- [ ] **Step 1: Write the failing test**

Create `src/domain/cost/cost-service.test.ts`. Build `TestLayer` from the in-memory store exactly as `src/domain/sandbox/sandbox-service.test.ts` does — open that file and copy its layer-assembly helper rather than inventing one.

`makeHarness` is shared by Tasks 6, 7, 8 and 9. Write it once, in `src/domain/cost/cost-test-support.ts`, with exactly this contract:

```ts
/** @Acp.Domain.Cost.TestSupport — a workspace, a priced spawn chain, helpers */
export interface CostHarness {
  readonly workspaceId: WorkspaceId
  /** work_root -> work_child -> work_grandchild, created via WorkUnitService. */
  readonly rootId: WorkId
  readonly childId: WorkId
  readonly grandchildId: WorkId
  /** Installs a budget on `workId` through CostService.setBudget. */
  readonly setBudget: (
    workId: WorkId,
    limitMicroUsd: number,
  ) => Effect.Effect<CostRollup, never>
  /** The workspace event log, newest 100, ascending by seq. */
  readonly readEvents: () => Effect.Effect<readonly Event[], never>
}

export const makeHarness: Effect.Effect<
  CostHarness,
  never,
  CostService | WorkUnitService | Storage
>
```

The installed price table must use `cpu_micro_usd_per_second: 10`, `mib_micro_usd_per_second: 1`, and one model `'claude-opus-5'` at `{ input: 15, output: 75, cached_input: 2 }` micro-USD per token — every expected figure in Tasks 6 through 9 is computed from exactly those rates.

Tests below call `h.setBudget(id, n)`; there is no separate `budget()` helper.

```ts
/** @Acp.Domain.Cost.Service.Test — entries append, rollups propagate */
import { describe, expect, it } from 'vitest'
import { Effect, Option, Schema } from 'effect'
import { CostEntryId, Timestamp, WorkId } from '../../protocol/schema/index.js'
import { CostService } from './cost-service.js'
import { zeroUsage } from './resource-usage.js'

const now = Schema.decodeUnknownSync(Timestamp)('2026-08-08T10:00:00Z')
const entryId = (raw: string) => Schema.decodeUnknownSync(CostEntryId)(raw)

describe('CostService.report', () => {
  it('prices an entry and raises the unit own and inclusive totals', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // `harness` must: create a workspace, install a price table with
        // cpu_micro_usd_per_second = 10, and create work unit `work_root`.
        const h = yield* makeHarness()
        const cost = yield* CostService
        yield* cost.report({
          entry_id: entryId('cost_1'),
          work_id: h.rootId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 3 },
          source: 'metered',
          now,
        })
        const rollup = yield* cost.rollupOf(h.rootId)
        expect(rollup.own_micro_usd).toBe(30)
        expect(rollup.inclusive_micro_usd).toBe(30)
      }).pipe(Effect.provide(TestLayer)),
    ))

  it('is idempotent — a replayed entry_id charges nothing twice', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        const cost = yield* CostService
        const input = {
          entry_id: entryId('cost_dup'),
          work_id: h.rootId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 1 },
          source: 'metered' as const,
          now,
        }
        yield* cost.report(input)
        yield* cost.report(input)
        const rollup = yield* cost.rollupOf(h.rootId)
        expect(rollup.own_micro_usd).toBe(10)
      }).pipe(Effect.provide(TestLayer)),
    ))

  it("charges a child's spend to every ancestor's inclusive total", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // harness creates work_root -> work_child -> work_grandchild
        const h = yield* makeHarness()
        const cost = yield* CostService
        yield* cost.report({
          entry_id: entryId('cost_deep'),
          work_id: h.grandchildId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 5 },
          source: 'metered',
          now,
        })
        expect((yield* cost.rollupOf(h.grandchildId)).own_micro_usd).toBe(50)
        expect((yield* cost.rollupOf(h.childId)).own_micro_usd).toBe(0)
        expect((yield* cost.rollupOf(h.childId)).inclusive_micro_usd).toBe(50)
        expect((yield* cost.rollupOf(h.rootId)).inclusive_micro_usd).toBe(50)
      }).pipe(Effect.provide(TestLayer)),
    ))

  it('refuses an unpriced model when a budget is in force', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        const cost = yield* CostService
        yield* h.setBudget(h.rootId, 1_000)
        const result = yield* Effect.either(
          cost.report({
            entry_id: entryId('cost_unpriced'),
            work_id: h.rootId,
            worker_id: Option.none(),
            usage: {
              ...zeroUsage,
              model: Option.some('mystery'),
              input_tokens: 5,
            },
            source: 'attested',
            now,
          }),
        )
        expect(result._tag).toBe('Left')
      }).pipe(Effect.provide(TestLayer)),
    ))

  it('accepts an unpriced model when no budget applies, recording the entry', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        const cost = yield* CostService
        const entry = yield* cost.report({
          entry_id: entryId('cost_free'),
          work_id: h.rootId,
          worker_id: Option.none(),
          usage: {
            ...zeroUsage,
            model: Option.some('mystery'),
            input_tokens: 5,
          },
          source: 'attested',
          now,
        })
        expect(entry.entry_id).toBe(entryId('cost_free'))
        expect((yield* cost.rollupOf(h.rootId)).own_micro_usd).toBe(0)
      }).pipe(Effect.provide(TestLayer)),
    ))

  it('rebuild restates own spend from the surviving entries', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        const cost = yield* CostService
        yield* cost.report({
          entry_id: entryId('cost_r1'),
          work_id: h.rootId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 2 },
          source: 'metered',
          now,
        })
        const rebuilt = yield* cost.rebuild(h.rootId)
        expect(rebuilt.own_micro_usd).toBe(20)
      }).pipe(Effect.provide(TestLayer)),
    ))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/cost-service.test.ts`
Expected: FAIL — cannot resolve `./cost-service.js`.

- [ ] **Step 3: Write the service**

Create `src/domain/cost/cost-service.ts`. Follow the `SandboxService` shape in `src/domain/sandbox/sandbox-service.ts`: an `Api` interface, a `Context.Tag`, a `make` generator, and a `Layer.effect` at the bottom.

```ts
/** @Acp.Domain.Cost.Service — the cost ledger and its derived rollups */
import { Context, Effect, Layer, Option, Schema } from 'effect'
import { Storage } from '../../infrastructure/storage/storage.js'
import { WorkUnitService } from '../work-units/index.js'
import {
  NotFoundError,
  StorageError,
  UnpricedModelError,
} from '../../protocol/errors/protocol-error.js'
import {
  CostEntry,
  CostRollup,
  PriceTable,
} from '../../protocol/schema/index.js'
import type {
  CostEntryId,
  CostSource,
  ResourceUsage,
  Timestamp,
  WorkId,
  WorkerId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { priceOf } from './price-table.js'
import {
  applyDescendant,
  applyOwn,
  emptyRollup,
  rebuildOwn,
} from './cost-rollup.js'

const ENTRIES = 'cost_entries'
const ROLLUPS = 'cost_rollups'
const PRICES = 'price_tables'

/**
 * A CAS loop must be bounded. An unbounded retry under contention is a hang
 * that reports itself as a slow request; failing loudly is the honest outcome.
 */
const MAX_CAS_ATTEMPTS = 16

export type CostServiceError = NotFoundError | UnpricedModelError | StorageError

export interface ReportCostInput {
  readonly entry_id: CostEntryId
  readonly work_id: WorkId
  readonly worker_id: Option.Option<WorkerId>
  readonly usage: ResourceUsage
  readonly source: CostSource
  readonly now: Timestamp
}

export interface CostServiceApi {
  readonly report: (
    input: ReportCostInput,
  ) => Effect.Effect<CostEntry, CostServiceError>
  readonly rollupOf: (
    workId: WorkId,
  ) => Effect.Effect<CostRollup, CostServiceError>
  readonly rebuild: (
    workId: WorkId,
  ) => Effect.Effect<CostRollup, CostServiceError>
}

export class CostService extends Context.Tag('CostService')<
  CostService,
  CostServiceApi
>() {}
```

The `make` generator implements, in this order:

1. **`ancestorsOf(workId)`** — read the unit via `WorkUnitService.get`, then follow `parent_id` upward, collecting ids from the unit outward. Cap the walk at `DEFAULT_DESCENDANT_LIMIT` from `work-unit-spawn-graph.ts` and fail `StorageError` if it is exceeded, so a cycle introduced by a bug cannot spin forever.
2. **`loadRollup(workId, workspaceId)`** — `storage.getVersioned(ROLLUPS, workId)`; on `None` return `{ value: emptyRollup(workId, workspaceId), version: -1 }`.
3. **`casRollup(workId, workspaceId, update)`** — loop up to `MAX_CAS_ATTEMPTS`: load, apply `update`, then `putIfAbsent` when version is `-1` else `replaceIfVersion`. Retry on `false`. After the cap, fail `new StorageError({ op: 'cost.rollup.cas', cause: 'contention' })`.
4. **`report(input)`** — `putIfAbsent(ENTRIES, entry_id, encoded)`; **if it returns `false`, return the stored entry and do nothing else** — that is the idempotency guarantee, and it must short-circuit before any rollup write. Otherwise price the usage against the workspace price table; on `Unpriced`, check whether any budget is on the ancestor path, failing `UnpricedModelError` when one is and treating the price as `0` when none is. Then `casRollup` the unit with `applyOwn` and each strict ancestor with `applyDescendant`.
5. **`rollupOf` / `rebuild`** — `rebuild` reads every entry via `storage.queryBy(ENTRIES, [{ field: 'work_id', value: workId }])`, prices each, and `casRollup`s with `rebuildOwn`.

Encode with `Schema.encodeSync(CostEntry)` before `put` and decode with `Schema.decodeUnknownSync(CostRollup)` after `get`, matching how the other services cross the `unknown`-typed `Storage` boundary.

Keep this file at or below 500 lines. If it grows past that, move `ancestorsOf` and `casRollup` into `src/domain/cost/cost-store.ts` and import them.

- [ ] **Step 4: Create the barrel**

Create `src/domain/cost/index.ts`:

```ts
/** @Acp.Domain.Cost — barrel */
export * from './resource-usage.js'
export * from './price-table.js'
export * from './cost-rollup.js'
export * from './budget-decision.js'
export * from './cost-service.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/`
Expected: PASS — all cost tests including the 6 service tests.

- [ ] **Step 6: Commit**

```bash
node_modules/.bin/prettier --write src/domain/cost && git add src/domain/cost && git commit -m "feat(cost): ledger service with idempotent entries and ancestor rollup"
```

---

### Task 7: Budgets, price tables, and the `budget.granted` event

**Files:**

- Modify: `src/domain/cost/cost-service.ts`
- Modify: `src/domain/cost/cost-service.test.ts`

**Interfaces:**

- Consumes: Task 6's service and `decide` / `BudgetOnPath` from Task 5.
- Produces, added to `CostServiceApi`:

```ts
readonly setBudget: (workId: WorkId, budget: Budget) => Effect.Effect<CostRollup, CostServiceError>
readonly setPriceTable: (table: PriceTable) => Effect.Effect<PriceTable, CostServiceError>
readonly budgetPath: (workId: WorkId) => Effect.Effect<readonly BudgetOnPath[], CostServiceError>
readonly checkAdmission: (workId: WorkId, now: Timestamp) => Effect.Effect<void, CostServiceError | BudgetExhaustedError>
```

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/cost/cost-service.test.ts`:

```ts
describe('CostService.checkAdmission', () => {
  it('admits when no budget is set anywhere on the path', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        const cost = yield* CostService
        const result = yield* Effect.either(cost.checkAdmission(h.childId, now))
        expect(result._tag).toBe('Right')
      }).pipe(Effect.provide(TestLayer)),
    ))

  it("refuses a child once the root's budget is spent by a sibling", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        const cost = yield* CostService
        yield* h.setBudget(h.rootId, 100)
        yield* cost.report({
          entry_id: entryId('cost_sib'),
          work_id: h.grandchildId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 20 },
          source: 'metered',
          now,
        })
        const result = yield* Effect.either(cost.checkAdmission(h.childId, now))
        expect(result._tag).toBe('Left')
      }).pipe(Effect.provide(TestLayer)),
    ))

  it('emits budget.granted when a budget is set', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        yield* h.setBudget(h.rootId, 100)
        const types = (yield* h.readEvents()).map((event) => event.type)
        expect(types).toContain('budget.granted')
      }).pipe(Effect.provide(TestLayer)),
    ))

  it('emits budget.exhausted when admission is refused', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const h = yield* makeHarness()
        const cost = yield* CostService
        yield* h.setBudget(h.rootId, 1)
        yield* cost.report({
          entry_id: entryId('cost_over'),
          work_id: h.rootId,
          worker_id: Option.none(),
          usage: { ...zeroUsage, cpu_seconds: 1 },
          source: 'metered',
          now,
        })
        yield* Effect.either(cost.checkAdmission(h.rootId, now))
        const types = (yield* h.readEvents()).map((event) => event.type)
        expect(types).toContain('budget.exhausted')
      }).pipe(Effect.provide(TestLayer)),
    ))
})
```

`h.readEvents()` reads the workspace event log through `Storage.readEventsTail`; add it to the harness alongside `setBudget`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/cost-service.test.ts`
Expected: FAIL — `cost.checkAdmission is not a function`.

- [ ] **Step 3: Implement the four methods**

In `src/domain/cost/cost-service.ts`:

- `setBudget` — `casRollup` setting `budget: Option.some(budget)`, then append a `budget.granted` event with `{ work_id, limit_micro_usd }` in the payload.
- `setPriceTable` — `storage.put(PRICES, table.workspace_id, Schema.encodeSync(PriceTable)(table))`.
- `budgetPath` — walk `ancestorsOf`, load each rollup, and keep those whose `budget` is `Some`, producing `BudgetOnPath` in unit-outward order.
- `checkAdmission` — `decide(budgetPath(workId))`; on `Refuse`, append a `budget.exhausted` event carrying the refused unit and the budget-carrying unit, then fail `BudgetExhaustedError`. **Append the event before failing**, so the record explains the refusal even though the call errored.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/cost/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
node_modules/.bin/prettier --write src/domain/cost && git add src/domain/cost && git commit -m "feat(cost): budgets, price tables, and admission with budget events"
```

---

### Task 8: Enforce at work-unit transitions

**Files:**

- Modify: `src/domain/work-units/work-unit-service.ts`
- Modify: `src/domain/work-units/work-unit-service.test.ts`
- Modify: `src/app/app-live.ts` (add `CostServiceLive` to the layer graph)

**Interfaces:**

- Consumes: `CostService.checkAdmission` from Task 7.
- Produces: `WorkUnitService.transition` now also fails with `BudgetExhaustedError`.

- [ ] **Step 1: Write the failing test**

Append to `src/domain/work-units/work-unit-service.test.ts`:

```ts
it('refuses a claim when the budget is exhausted', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const h = yield* makeHarness()
      const cost = yield* CostService
      const work = yield* WorkUnitService
      yield* h.setBudget(h.rootId, 1)
      yield* cost.report({
        entry_id: entryId('cost_spent'),
        work_id: h.rootId,
        worker_id: Option.none(),
        usage: { ...zeroUsage, cpu_seconds: 1 },
        source: 'metered',
        now,
      })
      const result = yield* Effect.either(
        work.transition(h.rootId, 'claimed', workerId, now),
      )
      expect(result._tag).toBe('Left')
    }).pipe(Effect.provide(TestLayer)),
  ))

it('does not interrupt work already running past its budget', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      // Enforcement is at boundaries, not continuous: a unit already in
      // `running` stays there, and only its next entry is refused.
      const h = yield* makeHarness()
      const cost = yield* CostService
      const work = yield* WorkUnitService
      yield* work.transition(h.rootId, 'claimed', workerId, now)
      yield* work.transition(h.rootId, 'running', workerId, now)
      yield* h.setBudget(h.rootId, 1)
      yield* cost.report({
        entry_id: entryId('cost_after'),
        work_id: h.rootId,
        worker_id: Option.none(),
        usage: { ...zeroUsage, cpu_seconds: 1 },
        source: 'metered',
        now,
      })
      const unit = yield* work.get(h.rootId)
      expect(Option.getOrThrow(unit).state).toBe('running')
    }).pipe(Effect.provide(TestLayer)),
  ))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/work-units/work-unit-service.test.ts`
Expected: FAIL — the first test's `result._tag` is `'Right'`.

- [ ] **Step 3: Add the check**

In `src/domain/work-units/work-unit-service.ts`, inside `transition`, after the existing legality check against `allowedTransitions` and before the write:

```ts
// Budget admission is checked only at entry boundaries: work already
// running past its budget is never interrupted mid-flight.
if (to === 'claimed' || to === 'running') {
  yield * cost.checkAdmission(workId, now)
}
```

Take `CostService` from the context at the top of `make`, and widen `transition`'s error type with `BudgetExhaustedError`.

**Watch the layer cycle:** `CostService` depends on `WorkUnitService` for the ancestor walk, so a naive `Layer` wiring will deadlock. Break it by having `CostServiceLive` depend on `Storage` only and read parent links directly from the `work_units` collection via `storage.get`, rather than through `WorkUnitService`. Change Task 6's `ancestorsOf` accordingly if you have not already.

- [ ] **Step 4: Wire the layer**

In `src/app/app-live.ts`, add `CostServiceLive` to the layer graph beside `SandboxLayer`, provided with `Storage`.

- [ ] **Step 5: Run the full suite**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
node_modules/.bin/prettier --write src && git add src && git commit -m "feat(cost): refuse claim and resume when a budget is exhausted"
```

---

### Task 9: Metered entries and sandbox admission

**Files:**

- Modify: `src/domain/sandbox/sandbox-service.ts`
- Modify: `src/domain/sandbox/sandbox-service.test.ts`

**Interfaces:**

- Consumes: `CostService.report` and `CostService.checkAdmission`.
- Produces: no new exports; `ensure` gains `BudgetExhaustedError`, and `stop` writes a metered `CostEntry`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/sandbox/sandbox-service.test.ts`:

```ts
it('refuses to provision a sandbox when the budget is exhausted', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const h = yield* makeHarness()
      const cost = yield* CostService
      const sandbox = yield* SandboxService
      yield* h.setBudget(h.rootId, 1)
      yield* cost.report({
        entry_id: entryId('cost_spent'),
        work_id: h.rootId,
        worker_id: Option.none(),
        usage: { ...zeroUsage, cpu_seconds: 1 },
        source: 'metered',
        now,
      })
      const result = yield* Effect.either(sandbox.ensure(h.rootId, now))
      expect(result._tag).toBe('Left')
    }).pipe(Effect.provide(TestLayer)),
  ))

it('writes a metered entry for the sandbox lifetime on stop', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const h = yield* makeHarness()
      const cost = yield* CostService
      const sandbox = yield* SandboxService
      yield* sandbox.ensure(h.rootId, startedAt)
      yield* sandbox.stop(h.rootId, stoppedAt)
      const rollup = yield* cost.rollupOf(h.rootId)
      expect(rollup.own_micro_usd).toBeGreaterThan(0)
    }).pipe(Effect.provide(TestLayer)),
  ))

it('does not double-charge a sandbox stopped twice', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const h = yield* makeHarness()
      const cost = yield* CostService
      const sandbox = yield* SandboxService
      yield* sandbox.ensure(h.rootId, startedAt)
      yield* sandbox.stop(h.rootId, stoppedAt)
      yield* Effect.either(sandbox.stop(h.rootId, stoppedAt))
      const rollup = yield* cost.rollupOf(h.rootId)
      expect(rollup.own_micro_usd).toBe(300)
    }).pipe(Effect.provide(TestLayer)),
  ))
```

With `startedAt = 10:00:00Z`, `stoppedAt = 10:00:30Z`, `cpu_micro_usd_per_second = 10` and a 1-CPU limit, the expected charge is `30 * 10 = 300`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/domain/sandbox/sandbox-service.test.ts`
Expected: FAIL — `stop` takes one argument and charges nothing.

- [ ] **Step 3: Implement**

In `src/domain/sandbox/sandbox-service.ts`:

- In `ensure`, after resolving the workspace root and before calling the provider, `yield* cost.checkAdmission(workId, now)`.
- Change `stop` to `stop(workId: WorkId, now: Timestamp)` and update the `SandboxServiceApi` signature and every caller.
- In `stop`, compute elapsed seconds from the handle's start time to `now`, build a `ResourceUsage` of `cpu_seconds = elapsed * cpuLimit` and `mib_seconds = elapsed * memoryLimitMib`, and `report` it with `source: 'metered'`.
- **Derive `entry_id` deterministically** as `` `cost_sandbox_${workId}_${startedAt}` ``. Idempotency then falls straight out of Task 6's `putIfAbsent`, which is what makes the double-stop test pass without any extra bookkeeping.

Charging the configured limit rather than measured consumption slightly over-charges an idle sandbox. That is the correct direction: the limit is capacity the platform reserved and could not give to anyone else.

- [ ] **Step 4: Run the full suite**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
node_modules/.bin/prettier --write src && git add src && git commit -m "feat(cost): meter sandbox lifetime and gate provisioning on budget"
```

---

### Task 10: HTTP contract

**Files:**

- Create: `src/infrastructure/http/acp-http-api-cost.ts`
- Modify: `src/infrastructure/http/acp-http-api.ts` (add `CostGroup`)
- Modify: `src/app/server/` handler wiring (follow the memory handlers)
- Modify: `src/infrastructure/http/production-route-inventory-test-support.ts`
- Regenerate: `openapi.json`

**Interfaces:**

- Consumes: schemas from Task 1, `CostService` from Tasks 6–7.
- Produces: `CostGroup`, `ReportCostPayload`, `SetBudgetPayload`.

Routes:

| Method | Path                                  | Purpose                  |
| ------ | ------------------------------------- | ------------------------ |
| POST   | `/v1/work/:work_id/cost`              | report an attested entry |
| GET    | `/v1/work/:work_id/cost`              | read the rollup          |
| PUT    | `/v1/work/:work_id/budget`            | set a budget             |
| PUT    | `/v1/workspaces/:workspace_id/prices` | set the price table      |

- [ ] **Step 1: Write the failing test**

Add to `src/infrastructure/http/acp-http-api.test.ts` a case asserting all four paths appear in the assembled API, following the existing assertions in that file for the memory and sandbox groups.

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/infrastructure/http/acp-http-api.test.ts`
Expected: FAIL — the cost paths are absent.

- [ ] **Step 3: Write the contract**

Create `src/infrastructure/http/acp-http-api-cost.ts`, modelled exactly on `acp-http-api-memory.ts`:

```ts
/** @Acp.Infra.Http.Api.Cost — cost ledger, budget and price-table contract */
import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'
import {
  Budget,
  CostEntry,
  CostEntryId,
  CostRollup,
  PriceTable,
  ProtocolError,
  ResourceUsage,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'

const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const ReportCostPayload = Schema.Struct({
  entry_id: CostEntryId,
  usage: ResourceUsage,
})
export type ReportCostPayload = typeof ReportCostPayload.Type

export const SetBudgetPayload = Schema.Struct({
  limit_micro_usd: Schema.Number.pipe(Schema.nonNegative()),
})
export type SetBudgetPayload = typeof SetBudgetPayload.Type

export const CostGroup = HttpApiGroup.make('cost')
  .add(
    HttpApiEndpoint.post('reportCost', '/v1/work/:work_id/cost')
      .setPath(Schema.Struct({ work_id: WorkId }))
      .setPayload(ReportCostPayload)
      .addSuccess(CostEntry, { status: 201 })
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(403))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.get('getCost', '/v1/work/:work_id/cost')
      .setPath(Schema.Struct({ work_id: WorkId }))
      .addSuccess(CostRollup)
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.put('setBudget', '/v1/work/:work_id/budget')
      .setPath(Schema.Struct({ work_id: WorkId }))
      .setPayload(SetBudgetPayload)
      .addSuccess(CostRollup)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(403))
      .addError(ProtocolError, protocolError(404)),
  )
  .add(
    HttpApiEndpoint.put('setPrices', '/v1/workspaces/:workspace_id/prices')
      .setPath(Schema.Struct({ workspace_id: WorkspaceId }))
      .setPayload(PriceTable)
      .addSuccess(PriceTable)
      .addError(ProtocolError, protocolError(400))
      .addError(ProtocolError, protocolError(401))
      .addError(ProtocolError, protocolError(403)),
  )
```

`Budget` is imported for the handler's construction of `set_by` / `set_at` from the session — the payload deliberately carries only the limit, because a caller must not be able to backdate or misattribute a budget grant.

- [ ] **Step 4: Wire the group and handlers**

Add `.add(CostGroup)` in `acp-http-api.ts`, implement the four handlers beside the memory handlers in `src/app/server/`, and add the four paths to `production-route-inventory-test-support.ts`.

**`reportCost` requires `x-acp-assertion`** per [[ADR-0024-worker-identity-provenance]], making it the fifth signed action. Reuse the existing assertion middleware rather than re-deriving the check — copy how the review handlers consume it.

- [ ] **Step 5: Regenerate the OpenAPI artifact**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsc -p tsconfig.build.json && node scripts/generate-openapi.mjs`
Then: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run src/infrastructure/http/openapi.test.ts`
Expected: PASS. Per [[ADR-0017-openapi-contract-artifact]], `openapi.json` is a tracked artifact and must be committed with the change that alters it.

- [ ] **Step 6: Run the full suite**

Run: `PATH=/opt/homebrew/bin:$PATH node_modules/.bin/vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
node_modules/.bin/prettier --write src openapi.json && git add src openapi.json && git commit -m "feat(cost): HTTP contract for cost reports, budgets and price tables"
```

---

### Task 11: ADR-0030 and wiki projection

**Files:**

- Create: `wiki/decisions/ADR-0030-cost-budget-accounting.md`
- Modify: `wiki/decisions/_MOC.md`
- Modify: `wiki/architecture/_MOC.md` (flip the design entry from DRAFT to IMPLEMENTED)
- Modify: `wiki/CHANGELOG.md`
- Modify: `README.md` (event vocabulary and error code tables)

- [ ] **Step 1: Write the ADR**

Create `wiki/decisions/ADR-0030-cost-budget-accounting.md` with `status: ACCEPTED` and the frontmatter shape used by `ADR-0029-resumption-event-accuracy.md`. State what was delivered, and record these rejections explicitly, since each was a live alternative:

- No `exhausted` work state — refusal is an error, not a state.
- Cost entries are not events — the causal spine stays coordination-only.
- Prices are not stored on entries — history is re-priced as a read-time view.
- Kubernetes is out of scope; this slice is protocol and domain only.

Record the known risk verbatim: **root CAS contention** under a deep spawn graph with chatty engines, mitigated by the aggregate-reporting requirement, with per-ancestor sharded counters as the deliberately unbuilt escape hatch.

- [ ] **Step 2: Update the MOCs, changelog, and README**

Add the ADR line to `wiki/decisions/_MOC.md` and `wiki/architecture/_MOC.md`, append a `wiki/CHANGELOG.md` entry, and extend the README's event-vocabulary and error-code tables with `budget.granted`, `budget.exhausted`, `budget_exhausted`, and `unpriced_model`.

- [ ] **Step 3: Run every gate**

```bash
PATH=/opt/homebrew/bin:$PATH node_modules/.bin/prettier --check . && node_modules/.bin/eslint . && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run && node scripts/check-file-size.mjs && node scripts/check-env-example.mjs
```

Expected: every command exits 0. Fix anything that does not before committing.

- [ ] **Step 4: Commit and open the PR**

```bash
node_modules/.bin/prettier --write wiki README.md && git add wiki README.md && git commit -m "docs(adr): ADR-0030 cost and budget accounting" && git push -u origin feat/cost-budget-accounting
```

Then open the PR with `gh pr create`, and run the Docker self-dogfood before merge:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/acp-docker-self-dogfood.mjs
```

---

## Notes for the executing agent

- **Branch first.** Other sessions edit this repo concurrently; check `git status` before branching and never commit another session's working changes.
- **The layer cycle in Task 8 is the one real trap here.** `CostService` needs parent links and `WorkUnitService` needs admission. Resolve it by having `CostService` read `work_units` rows through `Storage` directly. If you discover this only at Task 8, go back and change Task 6 rather than adding a lazy indirection.
- **Do not add fields to `INDEXED_FIELDS`.** `workspace_id` and `work_id` are already there, and adding a column changes every storage adapter and its conformance test for no gain.
