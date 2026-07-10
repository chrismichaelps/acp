---
type: module
path: '@root/src/infrastructure/github/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium]
aliases: [github-index]
---

# GitHub Infrastructure Barrel

## Purpose

Expose the supported [[GitHub]] seam types, gateway, adapters, and resolver from
one opaque infrastructure entrypoint.

## Interface

Re-exports `github-error`, `github-types`, `github-gateway`,
`github-gateway-fake`, `github-gateway-gh`, and `github-review-thread`.

## Algorithm

Static ESM re-exports only.

## Negative Logic

- ❌ Do NOT add runtime construction or domain logic.

## Depth

MEDIUM. One import boundary hides the folder layout from callers.

## Grill Log

- **Q:** Should test modules be exported? **A:** No. Only runtime contracts and
  adapters belong in the barrel.

## Referenced by

[[gh-bridge]] · [[github/_MOC]]
