---
type: module
path: '@root/src/infrastructure/github/github-gateway-gh.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
tags: [module, test]
aliases: [github-gateway-gh.test]
---

# GitHub Gateway gh Tests

## Purpose

Pin production-adapter argv construction, JSON normalization, and typed command
failure without invoking `gh`.

## Interface

Vitest suite injecting a scripted process runner into
[[github-gateway-gh|makeGhGateway]].

## Algorithm

Cover PR fetch, diff failure, merge method, REST comment list/post, and issue comment.

## Negative Logic

- ❌ Do NOT call a real GitHub account.

## Depth

MEDIUM. The fake runner makes external argv and error contracts deterministic.

## Grill Log

- **Q:** Where are resolution tests kept? **A:** Lookup mechanics live in
  [[github-review-thread.test]] and adapter lookup/mutation orchestration lives in
  [[github-gateway-gh-review-thread.test]], keeping this general adapter suite
  below the Split Protocol threshold.

## Referenced by

[[github-gateway-gh]] · [[github/_MOC]]
