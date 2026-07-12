---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-artifact-handlers.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, artifact]
aliases: [acp-rpc-artifact-handlers.test]
---

# ACP RPC Artifact Handler Tests

## Purpose

Prove [[acp-rpc-artifact-handlers]] direct create/update/content/list/delete
behavior for host-stored and external artifact evidence.

## Interface

Vitest `accessHandler` suite over the native RPC test runtime and typed payload
schemas.

## Algorithm

Initialize scoped RPC, create workspace/work and host-stored artifact, read and
replace its content, and list it by work/workspace. Create an external artifact
and require content lookup to fail. Delete the stored artifact and require later
content lookup to fail. Separately provide `AcpRpcActor` middleware context and
require creation attribution without bearer lookup.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT expose content for external or deleted artifacts.
- ❌ Do NOT lose artifact identity during update.
- ❌ Do NOT omit artifacts from either owning index.
- ❌ Do NOT override a middleware-provided actor with bearer fallback.

## Grill Log

- **Q:** Why test external and stored evidence together? **A:** They share the
  artifact model but intentionally differ at the content boundary. _Rejected:_
  treating URI presence as retrievable host content.

## Referenced by

[[acp-rpc-artifact-handlers]] · [[acp-rpc-handlers]] · [[rpc/_MOC]] ·
[[Transport]] · [[src/_MOC]]
