---
type: module
path: '@root/src/app/server/identity.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [id-clock, IdClock]
---

# IdClock

## Purpose

Composition-root primitive that mints entity ids and current timestamps, so the
transport layer can supply the `id`/`now` values the domain services deliberately
do not generate themselves.

## Interface

### Signatures

```typescript
export interface IdClockApi {
  readonly nextId: (prefix: string) => Effect<string>
  readonly now: Effect<Timestamp>
}
export class IdClock extends Context.Tag('IdClock')<IdClock, IdClockApi>() {}
export const IdClockLive: Layer.Layer<IdClock>
```

### Linkage

- **Requires:** [[common]] (`Timestamp`); Effect `Clock`, `Ref`, `DateTime`.
- **Consumed by:** [[acp-router]].

## Algorithm

`nextId` increments a `Ref` counter and combines it with `Clock.currentTimeMillis`
into `${prefix}_${ms}${n}` (base36). `now` reads `Clock.currentTimeMillis` and
formats it ISO via `DateTime`, branded as `Timestamp`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use `Date.now()`/`Math.random()` — clock comes from Effect `Clock`.
- ❌ Do NOT brand ids by entity here — callers decode `nextId` output to their id.

## Depth

MEDIUM (0.6). Hides counter state + ISO formatting; deterministic under a test
`Clock`.

## Referenced by

[[acp-router]] · [[server-index]] · [[src/_MOC]]
