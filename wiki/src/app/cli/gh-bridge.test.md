---
type: module
path: '@root/src/app/cli/gh-bridge.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
tags: [module, test, app, cli, github, bridge]
aliases: [gh-bridge.test]
---

# GitHub Bridge Tests

## Purpose

Prove [[gh-bridge]] imports PR evidence and reconciles ACP/GitHub review comments
bidirectionally without duplicate or feedback-loop mutations.

## Interface

Vitest integration suite using a live ephemeral ACP server, `NodeHttpClient`, and
the injected [[github-gateway-fake]].

## Algorithm

Import a seeded pull request and require both `diff` and `pull_request`
artifacts. For comment synchronization, claim and start real work, request a
persisted review, and use a session carrying `review:collaborate`; synthetic
review ids are not valid authorization targets. Sync two ACP-origin comments
outward and require their returned GitHub ids to be stamped into ACP. Import an
unseen GitHub comment with `origin=github` and its provider id. Repeat syncs to
prove stable cardinality, then combine both origins and prove neither a stamped
ACP comment nor mirrored GitHub comment loops back. Finally resolve a stamped
ACP comment and require GitHub thread resolution propagation.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT call a real GitHub repository in this deterministic suite.
- ❌ Do NOT repost ACP comments after `external_id` is set.
- ❌ Do NOT re-import a GitHub comment whose provider id is already indexed.
- ❌ Do NOT lose GitHub provenance on inward comments.
- ❌ Do NOT leave ACP resolution local when an external thread id exists.
- ❌ Do NOT bypass target-derived review authorization with fixture-only ids.

## Grill Log

- **Q:** Is unchanged count after a second sync sufficient? **A:** It is paired
  with fake gateway mutation counts and provenance assertions, proving both
  sides are loop-safe rather than merely deduplicated on read. _Rejected:_
  response-cardinality-only evidence.

## Referenced by

[[gh-bridge]] · [[gh-reconcile]] · [[github-gateway-fake]] · [[cli/_MOC]] ·
[[GitHub]] · [[src/_MOC]]
