---
type: module
path: '@root/src/infrastructure/github/pure-core-invariant.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
tags: [module, test]
aliases: [pure-core-invariant.test, pure-core-invariant]
---

# GitHub Pure-Core Invariant Test

## Purpose

Fail if GitHub infrastructure, `child_process`, or spawned `gh` commands leak into
domain modules or the main server composition.

## Interface

Vitest architecture test scanning production TypeScript source text.

## Algorithm

Recursively walk non-test `src/domain/**` plus `app-live.ts` and `http-app.ts`,
collect forbidden references, and require an empty leak list.

## Negative Logic

- ❌ Do NOT scan tests as production dependencies.
- ❌ Do NOT permit GitHub I/O in ACP's core host path.

## Depth

DEEP. One assertion protects the edge-only architecture across the domain tree.

## Grill Log

- **Q:** Why a source invariant in addition to dependency injection? **A:** The
  test prevents future direct imports or subprocess escape hatches that compile
  but violate the [[GitHub]] seam.

## Referenced by

[[GitHub]] · [[github-gateway]] · [[github/_MOC]]
