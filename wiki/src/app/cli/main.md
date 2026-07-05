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
`dist/app/cli/main.js`). Reads argv through [[node-process-io]], parses it via
[[cli-commands]], sends the
request through [[cli-client]] against `ACP_BASE_URL` (default
`http://localhost:${ACP_PORT}`), forwards `ACP_RPC_TOKEN` as a bearer session
when configured, prints [[cli-usage]] on parse failures, and prints the JSON
result.

## Interface

### Signatures

```typescript
// side-effecting entrypoint — no exports
NodeRuntime.runMain(program)
```

### Linkage

- **Requires:** [[cli-commands]], [[cli-client]], [[cli-usage]],
  [[node-process-io]], `@effect/platform-node` `NodeHttpClient`/`NodeRuntime`.
- **Consumed by:** the operator (`acp <command>` after build/install, or
  `node dist/app/cli/main.js <command>` in local smoke tests).

## Algorithm

1. `parseArgs(nodeArgv())` → `CliRequest` or print [[cli-usage]] and
   exit non-zero on `CliError`.
2. Read `ACP_RPC_TOKEN` once. For `stream`, open the SSE endpoint with the same
   bearer header policy as [[cli-client]] and print frames; otherwise
   `runCliRequest`, pass the body through [[cli-client]]'s `applyClientFilter`
   (a no-op unless `filterState` is set), and print it.
3. Provide `NodeHttpClient.layer`; `NodeRuntime.runMain`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse args anywhere but [[cli-commands]].
- ❌ Do NOT export — runnable entrypoint, excluded from [[cli-index]].
- ❌ Do NOT print bearer tokens when requests fail.

## Depth

SHALLOW (0.4) by design — a thin wiring root. The parser and client are tested;
this glue is exercised by a live smoke test.

## Referenced by

[[cli-index]] · [[Transport]] · [[src/_MOC]]
