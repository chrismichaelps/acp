---
type: module
path: '@root/src/app/server/resume-routes.test.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, resume, handoff]
aliases: [resume-routes.test]
---

# Resume Route Tests

## Purpose

Prove [[resume-routes]] reconstructs a work handoff from current state, ordered
checkpoints, artifact metadata/content, reviews, open comments, and latest grill
while preserving scope, workspace binding, and missing-resource semantics.

## Interface

Vitest integration suite over the in-process [[acp-router]] with scoped and
workspace-bound sessions.

## Algorithm

Create work, two checkpoints, external and stored artifacts, and a review. Pin
work readback, newest-first checkpoint listing/latest, artifact URI discovery,
review requirements, stored content, and the combined resume packet. Create a
second review gate with an open comment and grill, then require both in resume.
Reject authenticated reads without `workspace:read` and outside a session's
workspace binding. Return 404 when latest checkpoint is absent or content is
requested for an external artifact.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT make agents issue separate reads to recover the core handoff packet.
- ❌ Do NOT omit open review obligations or the latest grill from resume.
- ❌ Do NOT expose work outside a bearer session's workspace binding.
- ❌ Do NOT fabricate latest checkpoint or external artifact content.
- ❌ Do NOT expose stored content through ordinary artifact metadata lists.

## Grill Log

- **Q:** Why does external content return 404 instead of proxying the URI? **A:**
  ACP owns metadata for external evidence, not the provider's bytes or auth.
  _Rejected:_ implicit network fetches at the resume boundary.

## Referenced by

[[resume-routes]] · [[resume-workspace-routes.test]] · [[acp-router]] ·
[[server/_MOC]] · [[Transport]] · [[src/_MOC]]
