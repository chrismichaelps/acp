---
type: module
path: '@root/src/infrastructure/platform-node/node-process-io.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.52
depth_status: MEDIUM
tags: [module, seam]
aliases: [node-process-io]
---

# Node Process IO

## Purpose

Own direct `node:process` access for command-line entrypoints. The CLI and stdio
bridges remain application code, but argv, stdin chunks, and stdout writes are
now supplied by this Node platform adapter instead of being read directly from
the entrypoints.

## Interface

### Signatures

```typescript
export const nodeArgv: () => readonly string[]
export const nodeStdin: () => AsyncIterable<unknown>
export const nodeStdoutWrite: (chunk: string | Uint8Array) => void
export interface ProcessResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}
export const runProcess: (
  command: string,
  args: readonly string[],
  options?: { readonly input?: string },
) => Effect.Effect<ProcessResult>
```

### Linkage

- **Requires:** `node:process`.
- **Consumed by:** [[cli-main]] and [[stdio-main]].

## Algorithm

`nodeArgv` returns `process.argv.slice(2)` so [[cli-main]] can pass just the user
tokens to [[cli-commands]]. `nodeStdin` returns the process stdin async iterable
used by the JSON-RPC stdio frame loop. `nodeStdoutWrite` writes pre-framed bytes
or strings to stdout without adding logging, newlines, or JSON decoration.

`runProcess` executes a command with `execFile` and `shell: false`, captures up to
64 MiB each of stdout/stderr, optionally closes stdin with caller-provided text,
and returns every outcome as `ProcessResult`. Ordinary non-zero exits preserve
their numeric status; spawn failures use `-1` and expose the OS diagnostic in
stderr.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse CLI commands here; [[cli-commands]] owns argv grammar.
- ❌ Do NOT decode Content-Length frames here; [[stdio-frames]] owns framing.
- ❌ Do NOT log from this adapter; stdout is protocol/user output.
- ❌ Do NOT execute subprocesses through a shell.
- ❌ Do NOT throw for an ordinary non-zero child exit.

## Depth

MEDIUM (0.52). Small adapter, but it keeps Node process IO behind the
spec-required `platform-node` boundary and protects stdio protocol output from
application logging concerns.

## Referenced by

[[platform-node-index]] · [[cli-main]] · [[stdio-main]] ·
[[node-process-io.test]] · [[Transport]]
