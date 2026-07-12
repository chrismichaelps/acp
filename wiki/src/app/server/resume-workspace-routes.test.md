---
type: module
path: '@root/src/app/server/resume-workspace-routes.test.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, resume, etag, tokens]
aliases: [resume-workspace-routes.test]
---

# Resume Workspace Route Tests

## Purpose

Prove [[resume-routes]] exposes [[resume-workspace]] ETag revalidation and
salience budgeting without making the full packet inaccessible.

## Interface

Vitest integration suite over the in-process [[acp-router]] using work and
artifact mutations to drive packet state.

## Algorithm

Read a resume packet, require a non-empty ETag, then revalidate with
`If-None-Match` and require 304, empty body, and the same tag. Mutate packet state
by adding an artifact and require the ETag to change. Add three artifacts, request
`?budget=2`, and require two inline plus one elided reference; then read without a
budget and require all three inline with a distinct ETag.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT return a body on a matching 304 response.
- ❌ Do NOT preserve an ETag after packet state changes.
- ❌ Do NOT discard elided identity; return count and ids.
- ❌ Do NOT let a budgeted ETag collide with the full-packet ETag.
- ❌ Do NOT make budgeting mandatory for clients that request the full packet.

## Grill Log

- **Q:** Why include budget in the digest? **A:** The representation changes even
  when underlying state does not; validators must identify the selected view.
  _Rejected:_ one ETag shared by full and budgeted payloads.

## Referenced by

[[resume-routes]] · [[resume-workspace]] · [[resume-routes.test]] ·
[[server/_MOC]] · [[Transport]] · [[src/_MOC]]
