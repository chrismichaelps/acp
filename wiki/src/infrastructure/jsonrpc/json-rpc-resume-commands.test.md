---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-resume-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, json-rpc, resume]
aliases: [json-rpc-resume-commands.test]
---

# JSON-RPC Resume Command Tests

## Purpose

Pin [[json-rpc-resume-commands]] work/workspace resume reads and artifact content
reads to their canonical REST routes with safe identifier encoding.

## Interface

Vitest mapping suite over [[json-rpc]] `parseJsonRpcCommand`.

## Algorithm

Project `work.get` and workspace work indexing; work- and workspace-scoped
checkpoint, artifact, and review lists; latest checkpoint lookup; and artifact
content read. Every fixture includes slash/space-bearing identifiers and requires
the exact encoded path and method label.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT interpolate raw resource identifiers into paths.
- ❌ Do NOT confuse work-scoped evidence with workspace aggregate evidence.
- ❌ Do NOT map latest checkpoint or artifact content to collection routes.

## Grill Log

- **Q:** Why exercise every resume projection? **A:** Handoff reconstruction
  spans several aggregates; one wrong scope can silently omit or cross-contaminate
  evidence. _Rejected:_ one representative path test.

## Referenced by

[[json-rpc-resume-commands]] · [[jsonrpc/_MOC]] · [[Transport]] · [[src/_MOC]]
