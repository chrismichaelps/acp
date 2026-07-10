---
type: test
path: '@root/src/infrastructure/rpc/acp-rpc-roundtrip-artifact-checkpoint.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.45
depth_status: SHALLOW
tags: [test, rpc, roundtrip, artifact, checkpoint]
aliases:
  [
    acp-rpc-roundtrip-artifact-checkpoint.test,
    acp-rpc-roundtrip-artifact-checkpoint-test,
  ]
---

# ACP RPC Roundtrip Artifact Checkpoint Test

## Purpose

Exercise the generated native RPC client across artifact evidence and checkpoint
resume methods. These verticals are separate from the aggregate handler module,
so this test guards their contract integration after the actor context bridge.

## Behavior

The test initializes a scoped session, creates a workspace and work item, then
drives artifact create/update/content/list/delete and checkpoint
create/list/latest/list-for-workspace through the generated client. Assertions
pin updated evidence content, list membership, deletion identity, and latest
checkpoint selection.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT assert only the creation path; list and latest reads are what prove
  persisted evidence remains discoverable after writes.
- ❌ Do NOT route through REST or JSON-RPC compatibility layers.

## Referenced by

[[acp-rpc-artifact-handlers]] · [[acp-rpc-checkpoint-handlers]] ·
[[acp-rpc-client]] · [[acp-rpc-server]] · [[rpc/_MOC]]
