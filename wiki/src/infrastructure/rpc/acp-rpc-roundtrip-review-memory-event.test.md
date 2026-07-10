---
type: test
path: '@root/src/infrastructure/rpc/acp-rpc-roundtrip-review-memory-event.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.45
depth_status: SHALLOW
tags: [test, rpc, roundtrip, review, memory, event]
aliases:
  [
    acp-rpc-roundtrip-review-memory-event.test,
    acp-rpc-roundtrip-review-memory-event-test,
  ]
---

# ACP RPC Roundtrip Review Memory Event Test

## Purpose

Exercise the generated native RPC client across review gates, memory records,
and event reads. This covers the human-in-the-loop and event-log portions of the
native RPC surface that sit above ordinary work mutation.

## Behavior

The test creates running work items, requests reviews, and drives approve,
cancel, request-changes, and reject outcomes through the generated client. It
then verifies review list membership, creates and lists a memory record, publishes
a work event, and confirms the event is visible through `events.list`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT reduce this to a single review outcome; the state machine branches
  must stay contract-covered.
- ❌ Do NOT use subscription streaming here; [[native-rpc-route]] already covers
  `events.subscribe`, while this test pins unary event listing.

## Referenced by

[[acp-rpc-client]] · [[acp-rpc-memory-event-handlers]] ·
[[acp-rpc-review-handlers]] · [[acp-rpc-server]] · [[rpc/_MOC]]
