---
type: module
path: '@root/src/app/cli/review-comment-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, review-comment]
aliases: [cli-review-comment-commands.test, review-comment-commands.test]
---

# CLI Review Comment Command Tests

## Purpose

Prove [[cli-review-comment-commands]] constructs diff-anchored comment payloads
and routes comment state/list operations through longest-prefix dispatch.

## Interface

Vitest suite driving `review comment` argv through the central
[[cli-commands|parseArgs]] registry.

## Algorithm

Add a comment with review/work/workspace/artifact identity, file side/body,
numeric line, and reply id; then prove optional line/reply fields are omitted
when absent. Pin bodyless resolve/reopen by comment id, list by review or work,
and reject add when required anchor fields are incomplete.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT serialize the diff line as a string.
- ❌ Do NOT materialize absent optional line or reply fields.
- ❌ Do NOT let the two-token add handler capture resolve/reopen/list commands.
- ❌ Do NOT send a partial diff anchor to the host.

## Grill Log

- **Q:** What guards the ambiguous `review comment` prefix? **A:** The registry's
  longest-prefix rule selects three-token lifecycle/list handlers before the
  two-token add handler. _Rejected:_ order-dependent manual branching.

## Referenced by

[[cli-review-comment-commands]] · [[cli-commands]] ·
[[command-registry.test]] · [[cli/_MOC]] · [[Transport]] · [[src/_MOC]]
