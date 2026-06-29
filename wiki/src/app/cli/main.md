---
type: module
path: '@root/src/app/cli/main.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.4
depth_status: SHALLOW
tags: [module, entrypoint]
aliases: [cli-main]
---

# CLI Entrypoint

## Purpose

The packaged `acp` CLI entrypoint (`package.json` `bin` →
`dist/app/cli/main.js`). Parses `process.argv` via [[cli-commands]], sends the
request through [[cli-client]] against `ACP_BASE_URL` (default
`http://localhost:${ACP_PORT}`), prints [[cli-usage]] on parse failures, and
prints the JSON result.

## Interface

### Signatures

```typescript
// side-effecting entrypoint — no exports
NodeRuntime.runMain(program)
```

### Linkage

- **Requires:** [[cli-commands]], [[cli-client]], [[cli-usage]],
  `@effect/platform-node`
  `NodeHttpClient`/`NodeRuntime`, `node:process`.
- **Consumed by:** the operator (`acp <command>` after build/install, or
  `node dist/app/cli/main.js <command>` in local smoke tests).

## Algorithm

1. `parseArgs(process.argv.slice(2))` → `CliRequest` or print [[cli-usage]] and
   exit non-zero on `CliError`.
2. For `stream`, open the SSE endpoint and print frames; otherwise `runCliRequest`
   and print `{ status, body }`.
3. Provide `NodeHttpClient.layer`; `NodeRuntime.runMain`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse args anywhere but [[cli-commands]].
- ❌ Do NOT export — runnable entrypoint, excluded from [[cli-index]].

## Depth

SHALLOW (0.4) by design — a thin wiring root. The parser and client are tested;
this glue is exercised by a live smoke test.

## Referenced by

[[cli-index]] · [[Transport]] · [[src/_MOC]]
