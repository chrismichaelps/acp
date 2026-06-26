---
type: grammar
language: TypeScript
version: "6.0.3"
runtime: "Node.js 24"
tags: [grammar]
aliases: [grammar/typescript, effect-grammar]
---

# Grammar — TypeScript + Effect

> Sovereign syntax truth for the ACP reference implementation. The Shadow role
> anchors here before writing any line of code (Constitution Law 4). A pattern
> missing from this page is recorded under `## Senior Definition Needed`, never
> guessed from training data.

## Pinned SDK Versions (verified against `node_modules`, 2026-06-25)

| Package | Version | Role |
|---------|---------|------|
| `typescript` | `6.0.3` | strict compiler, `module: NodeNext` |
| `effect` | `3.21.4` | runtime, Layer, Schema, Config, Data, Stream, PubSub, HashMap, Chunk, Option, Duration |
| `@effect/platform` | `0.96.2` | `HttpApi*`, `HttpServer`, `FileSystem`, `Path`, `Command`, `Socket` abstractions |
| `@effect/platform-node` | `0.107.0` | `NodeHttpServer`, `NodeContext`, `NodeRuntime`, Node Layer implementations |
| `vitest` | `4.x` | test runner (`pnpm test`) |

## SDK Discovery Map

Scan these before generating library syntax — do not recall from memory:
- `@root/node_modules/effect/dist/dts/index.d.ts` — barrel of core modules.
- `@root/node_modules/@effect/platform/dist/dts/index.d.ts` — `HttpApi`, `HttpApiBuilder`, `HttpApiGroup`, `HttpApiEndpoint`, `HttpApiSchema`, `HttpServer`, `HttpServerResponse`.
- `@root/node_modules/@effect/platform-node/dist/dts/index.d.ts` — `NodeHttpServer`, `NodeContext`, `NodeRuntime`.

## Imports / Namespaces (immutable references)

```typescript
// Core — always namespace imports from the "effect" barrel
import {
  Effect, Layer, Context, Config, Data, Duration,
  Option, Either, Chunk, HashMap, HashSet, Stream, PubSub, Schema,
} from 'effect'

// Platform (transport edge only — never in domain code)
import { HttpApi, HttpApiGroup, HttpApiEndpoint, HttpApiBuilder, HttpApiSchema } from '@effect/platform'
import { HttpServer, HttpServerResponse } from '@effect/platform'

// Node Layers — wired ONLY in apps/server/main.ts and apps/cli/main.ts
import { NodeHttpServer, NodeContext, NodeRuntime } from '@effect/platform-node'
```

NodeNext ESM requires explicit `.js` extensions on **relative** imports:

```typescript
import { WorkId } from './work-unit.schema.js'   // ✅ .js even though source is .ts
```

## Core Primitives

```typescript
// Branded ID — the canonical ACP identifier shape
export const WorkId = Schema.String.pipe(Schema.brand('WorkId'))
export type WorkId = Schema.Schema.Type<typeof WorkId>

// Service definition + Layer in one (preferred for stateful services)
export class WorkUnitStore extends Effect.Service<WorkUnitStore>()('WorkUnitStore', {
  effect: Effect.gen(function* () {
    /* construct interface */
    return { /* methods returning Effect.Effect<A, E, R> */ }
  }),
}) {}

// Pure interface tag (preferred when multiple swappable adapters exist — a SEAM)
export class Storage extends Context.Tag('Storage')<Storage, StorageApi>() {}
```

## Architectural Laws

- **Export Law** — each capability folder exposes exactly one `Layer` + one service `Tag` through its `index.ts` (Opaque API). Callers import the tag, never the construction.
- **Transformation Law** — external shape → domain model conversion happens only at a boundary: HTTP decode, Storage adapter, CLI parse. Domain code never sees raw JSON.
- **Propagation Law** — wrap a sibling service's typed error into your own tagged error; never let a foreign error type leak through your interface. Unknown defects convert to `internal_error` only at the transport boundary.
- **Schema-at-the-Edge Law** — every external input is decoded with `Schema.decodeUnknown` before it reaches a service; every output is `Schema.encode`d at the edge.

## Syntax Rules / Naming

- PascalCase for schemas, services, classes, tags. camelCase for methods/locals.
- Branded types for every protocol identifier (`WorkId`, `WorkerId`, `LeaseId`, …).
- `Option<A>` for absence — never `null`/`undefined` in domain code (Constitution + spec §16.7).
- `Duration` for all TTL / heartbeat / timeout values, loaded from `Config` when configurable.
- `HashMap`/`HashSet`/`Chunk` for collections crossing service boundaries; native `Map`/`Set`/arrays only inside a single function or at the JSON edge.
- Domain services return `Effect.Effect<Success, DomainError, Requirements>` — typed error channel, never `throw`, never `Promise` reject.

## Config Idioms

```typescript
const port = Config.integer('ACP_PORT').pipe(Config.withDefault(4317))
const leaseTtl = Config.duration('ACP_DEFAULT_LEASE_TTL').pipe(
  Config.withDefault(Duration.minutes(15)),
)
const token = Config.redacted('ACP_AUTH_TOKEN')   // never logged in plaintext
```

## Tagged Error Idiom

```typescript
export class LeaseConflictError extends Data.TaggedError('LeaseConflictError')<{
  readonly resourceUri: string
  readonly holderWorkerId: string
}> {}
```

## HTTP Transport Idiom (declarative — preferred over raw HttpRouter)

```typescript
const workGroup = HttpApiGroup.make('work').add(
  HttpApiEndpoint.post('claim', '/v1/work/:workId/claim')
    .setPayload(ClaimPayload)
    .addSuccess(WorkUnit)
    .addError(InvalidStateTransitionError, { status: 409 }),
)
export class AcpApi extends HttpApi.make('acp').add(workGroup) {}
```

## Prohibited Patterns

- ❌ no explicit `any` (ESLint `no-explicit-any: error`) — narrow at the boundary with a documented comment if truly unavoidable.
- ❌ no `var`; no floating promises (`no-floating-promises: error`).
- ❌ no `null`/`undefined` for domain absence — use `Option`.
- ❌ no Node built-ins (`fs`, `path`, `http`, `child_process`, `process`) imported in `domain/*` or `protocol/*` — use Effect Platform services; wire Node Layers only in `apps/*`.
- ❌ no `throw` / `try/catch` in domain code — errors flow through the `E` channel.
- ❌ no business logic inside HTTP handlers — decode → delegate to service → encode.
- ❌ no mutable `Map`/`Set`/array escaping a domain service.

## Senior Definition Needed

(empty — record any missing pattern here instead of guessing, per Law 4)

## Referenced by

(maintained by Forensic Guardian)
