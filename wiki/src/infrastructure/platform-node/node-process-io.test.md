---
type: module
path: '@root/src/infrastructure/platform-node/node-process-io.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, infrastructure, platform-node, process]
aliases: [node-process-io.test]
---

# Node Process IO Tests

## Purpose

Pin [[node-process-io]] subprocess execution as a total result adapter: stdout,
stderr, exit status, spawn failure, and optional stdin are returned as data.

## Interface

Vitest suite over the Effect-based `runProcess` adapter and real Node child
processes.

## Algorithm

Run a successful Node command and capture exact stdout with code 0. Run a command
that writes stderr and exits 3 without throwing. Attempt a nonexistent binary and
require code -1 plus diagnostic stderr. Pipe supplied input through a child and
require exact stdout echo.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT throw merely because a child exits non-zero.
- ❌ Do NOT confuse an OS spawn failure with a child's numeric exit status.
- ❌ Do NOT drop caller-provided stdin or captured stderr.
- ❌ Do NOT invoke commands through a shell.

## Grill Log

- **Q:** Why normalize spawn failure to -1? **A:** Callers need one total result
  shape while preserving ordinary child exit codes. _Rejected:_ mixing rejected
  Effects and returned exit results for routine process outcomes.

## Referenced by

[[node-process-io]] · [[platform-node/_MOC]] · [[src/_MOC]]
