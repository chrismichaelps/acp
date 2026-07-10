---
type: module
path: '@root/src/domain/review-comments/index.ts'
fidelity: Active
domain: '[[ReviewComment]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium]
aliases: [review-comment-index]
---

# Review Comment Service Barrel

## Purpose

Expose the [[ReviewComment]] service through one opaque domain import boundary.

## Interface

Re-exports all public contracts from [[review-comment-service]].

## Algorithm

Static ESM re-export only.

## Negative Logic

- ❌ Do NOT add persistence or transition behavior to the barrel.

## Depth

MEDIUM (0.45). The Export Law stabilizes imports despite a tiny implementation.

## Grill Log

- **Q:** Why retain a two-line barrel? **A:** It prevents callers from coupling to
  service-file layout and matches every domain capability folder.

## Referenced by

[[review-comments/_MOC]] · [[domain/_MOC]]
