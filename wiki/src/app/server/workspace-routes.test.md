---
type: module
path: '@root/src/app/server/workspace-routes.test.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, workspace, resume]
aliases: [workspace-routes.test]
---

# Workspace Route Tests

## Purpose

Prove [[workspace-routes]] returns workspace-isolated work and resume evidence
indexes while enforcing read scope and session workspace bindings.

## Interface

Vitest integration suite over the in-process [[acp-router]] with scoped and
optionally workspace-bound sessions.

## Algorithm

Create work in two workspaces and require the indexed route to return only the
target workspace. Reject an authenticated index read without `workspace:read`
and a bound session reading another workspace. Create running work with a
checkpoint, artifact, and review, then require each workspace aggregate route to
return only its matching evidence. Reject aggregate reads without the read scope.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT leak work or evidence across workspace indexes.
- ❌ Do NOT infer aggregate read authority from write/create scopes.
- ❌ Do NOT ignore explicit session workspace bindings.
- ❌ Do NOT scan/filter raw storage inside route code.
- ❌ Do NOT make one evidence category's success stand in for all aggregates.

## Grill Log

- **Q:** Why test checkpoints, artifacts, and reviews separately? **A:** They are
  owned by different services and can drift independently even behind symmetric
  URLs. _Rejected:_ a single aggregate smoke as proof of all three.

## Referenced by

[[workspace-routes]] · [[acp-router]] · [[server/_MOC]] · [[Workspace]] ·
[[Transport]] · [[src/_MOC]]
