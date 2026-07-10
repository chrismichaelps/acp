---
type: test
path: '@root/src/infrastructure/rpc/acp-rpc-roundtrip-work-lease.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.45
depth_status: SHALLOW
tags: [test, rpc, roundtrip, work, lease]
aliases: [acp-rpc-roundtrip-work-lease.test, acp-rpc-roundtrip-work-lease-test]
---

# ACP RPC Roundtrip Work Lease Test

## Purpose

Exercise the generated native RPC client across the worker, workspace, work, and
lease method families. This is parity coverage for the aggregate handler module
after the actor-bridge sweep completed.

## Behavior

The test initializes a session with read/write, work, and lease scopes, then
drives the generated client through worker discovery, workspace create/update/
archive, work create/list/get/claim/update-state, and lease
request/list/renew/release/revoke. Assertions pin identity, state transitions,
optional assignments, lease readback state, and void release behavior at the
typed client boundary.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT collapse this into the smaller workspace smoke test; leases and work
  assignment are the concurrency primitives most likely to regress.
- ❌ Do NOT bypass generated client calls with service-level helpers.

## Referenced by

[[acp-rpc-client]] · [[acp-rpc-handlers]] · [[acp-rpc-server]] · [[rpc/_MOC]]
