---
type: module
path: '@root/src/infrastructure/github/github-types.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test]
aliases: [github-types.test]
---

# GitHub Types Tests

## Purpose

Pin full URL, short ref, and invalid PR-reference parsing.

## Interface

Vitest suite for [[github-types|parsePrRef]].

## Algorithm

Assert both accepted shapes normalize identically and malformed input returns Left.

## Negative Logic

- ❌ Do NOT perform GitHub I/O.

## Depth

MEDIUM. Three cases protect the bridge's public PR-reference boundary.

## Grill Log

- **Q:** Why test both forms? **A:** Both are documented bridge inputs and must
  normalize to one `PrRef` contract.

## Referenced by

[[github-types]] · [[github/_MOC]]
