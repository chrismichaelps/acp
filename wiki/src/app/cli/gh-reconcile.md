---
type: module
path: '@root/src/app/cli/gh-reconcile.ts'
fidelity: Active
domain: '[[ReviewComment]]'
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.76
depth_status: DEEP
tags: [module, deep]
aliases: [gh-reconcile]
---

# GitHub Reconciliation

## Purpose

Define pure provenance, identity, side-mapping, import-payload, and merge-gate
rules shared by [[gh-bridge]] without performing ACP or [[GitHub]] I/O.

## Interface

Exports wire comment/resume shapes; side conversion; ACP comments awaiting post
or resolution propagation; external-id indexing; GitHub comments awaiting import;
`toAcpImportPayload`; `evaluateMergeGate`; and `formatDecision`.

## Algorithm

ACP-origin comments without `external_id` post outward. GitHub comments whose ids
are absent from the ACP index import inward with `origin: github`. Resolved ACP
comments with external ids propagate resolution. Merge passes only when any review
is approved, latest grill is passed, and `open_comments` is empty; decision text
summarizes those same three facts.

## Negative Logic

- ❌ Do NOT perform network or storage effects in reconciliation helpers.
- ❌ Do NOT repost GitHub-origin or already-stamped ACP comments.
- ❌ Do NOT permit merge while approval, grill, or comment obligations remain.

## Depth

DEEP (0.76). Small pure surfaces hide loop prevention and a three-source merge
gate that would otherwise leak across orchestration branches.

## Grill Log

- **Q:** Why is `external_id` the loop guard? **A:** It is the durable provider
  identity shared by both directions; content matching is ambiguous and mutable.
- **Q:** Why is merge evaluation read-only? **A:** Merge must consume existing
  [[Review]]/[[Grill]] evidence, never manufacture approval while deciding.

## Referenced by

[[gh-reconcile.test]] · [[gh-merge.test]] · [[gh-bridge.test]] · [[gh-bridge]] ·
[[ReviewComment]] · [[cli/_MOC]]
