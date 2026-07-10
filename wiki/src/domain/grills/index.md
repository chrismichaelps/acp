---
type: module
path: '@root/src/domain/grills/index.ts'
fidelity: Active
domain: '[[Grill]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium]
aliases: [grill-index]
---

# Grill Service Barrel

## Purpose

Expose the [[Grill]] service through one opaque domain import boundary.

## Interface

Re-exports all public contracts from [[grill-service]].

## Algorithm

Static ESM re-export only.

## Negative Logic

- ❌ Do NOT add construction or gate behavior to the barrel.

## Depth

MEDIUM (0.45). The implementation is tiny by Export Law but hides file layout
from consumers.

## Grill Log

- **Q:** Is this shallow pass-through removable? **A:** No. The Grammar Export Law
  makes the folder barrel the stable public surface; callers avoid internal paths.

## Referenced by

[[grills/_MOC]] · [[domain/_MOC]]
