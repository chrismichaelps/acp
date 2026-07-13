---
type: module
path: '@root/src/app/server/review-collaboration-auth.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, auth, review]
aliases: [review-collaboration-auth.test]
---

# Review Collaboration Auth Tests

## Purpose

Pin the focused [[review-collaboration-auth]] boundary independently of route
payload validation and domain mutation behavior.

## Interface

Vitest suite over the four target helpers with in-memory review, comment, grill,
question, work, session, and workspace fixtures.

## Algorithm

For each target family, prove scope is checked before lookup; a missing target
and an existing foreign target yield byte-equivalent `NotFoundError` data after
scope succeeds; an in-workspace target returns its actor and persisted ownership
chain. Cover review → work → workspace and question → grill → workspace hops
explicitly so no route can regress to body-authorized tenancy.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT infer helper behavior only from route integration tests.
- ❌ Do NOT reveal foreign workspace or parent identifiers in denial data.
- ❌ Do NOT mock the helper itself in this focused suite.

## Referenced by

[[review-collaboration-auth]] · [[review-comment-routes.test]] ·
[[grill-routes.test]] · [[server/_MOC]] · [[Transport]] · [[src/_MOC]]
