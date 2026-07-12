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

Composition-root primitive that mints entity ids, bearer credentials, and
current timestamps, so the transport layer can supply the `id`/`now` values the
domain services deliberately do not generate themselves. Ordinary protocol
records use deterministic, prefixed ids; session bearer tokens use
cryptographic randomness because they are credentials rather than just
identifiers.

## Interface

### Signatures

```typescript
export interface IdClockApi {
  readonly nextId: (prefix: string) => Effect<string>
  readonly secureToken: (prefix: string) => Effect<string>
  readonly now: Effect<Timestamp>
}
export class IdClock extends Context.Tag('IdClock')<IdClock, IdClockApi>() {}
export const IdClockLive: Layer.Layer<IdClock>
```

### Linkage

- **Requires:** [[common]] (`Timestamp`); Effect `Clock`, `Ref`, `DateTime`;
  Node `crypto` at the server composition edge.
- **Consumed by:** [[acp-router]].

## Algorithm

`nextId` increments a `Ref` counter and combines it with `Clock.currentTimeMillis`
into `${prefix}_${ms}${n}` (base36). `secureToken` uses Node's CSPRNG to produce
32 bytes of entropy, hex-encoded as `${prefix}_${hex}`; it is reserved for
bearer credentials such as `session_id`, where timestamp/counter predictability
would be a security bug. `now` reads `Clock.currentTimeMillis` and formats it ISO
via `DateTime`, branded as `Timestamp`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use `Date.now()`/`Math.random()` — clock comes from Effect `Clock`.
- ❌ Do NOT brand ids by entity here — callers decode `nextId` output to their id.
- ❌ Do NOT mint bearer credentials with `nextId`; use `secureToken`.

## Depth

MEDIUM (0.6). Hides counter state, timestamp formatting, and bearer-token
entropy behind one composition-root service while keeping domain services free
of id and clock generation.

## Referenced by

[[identity.test]] · [[acp-router]] · [[server-index]] · [[src/_MOC]]
