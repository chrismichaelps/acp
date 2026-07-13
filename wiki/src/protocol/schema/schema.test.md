---
type: module
path: '@root/src/protocol/schema/schema.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, protocol, schema, aggregate]
aliases: [schema.test]
---

# Aggregate Protocol Schema Tests

## Purpose

Pin the public [[schema-index]] decoding laws shared across Worker, Session,
WorkUnit, Workspace, Lease, Event, Memory, and Review wire contracts.

## Interface

Vitest suite over schemas imported only through the public protocol barrel.

## Algorithm

Decode valid workers and optional vendor, reject unknown kinds; default or
preserve session workspace bindings; decode WorkUnit optionals and
`changes_requested`, reject empty titles; default create-work priority. Decode
workspace defaults/metadata, nested lease resources, known events and reject
unknown event types. Decode memory records/payload/query plus `memory.created`.
Preserve optional signed review approval evidence.
Decode `review:collaborate` and `review:respond` individually while continuing
to decode sessions that contain only older valid permissions. Reject a session
containing both new scopes with the exact mutual-exclusion issue. Reject an
unknown permission literal rather than widening the closed vocabulary.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT expose absent optionals as undefined/empty wire values.
- ❌ Do NOT accept unknown worker kinds or event vocabulary.
- ❌ Do NOT accept empty WorkUnit titles.
- ❌ Do NOT drop session bindings or review signature evidence.
- ❌ Do NOT reject either additive review permission when it appears alone.
- ❌ Do NOT allow the response and collaboration scopes in one session.
- ❌ Do NOT treat `workspace:write`, `review:collaborate`, and `review:respond`
  as codec aliases.

## Grill Log

- **Q:** Why retain a broad barrel-level suite? **A:** It proves consumers get
  one coherent public schema surface, not just independently valid files.
  _Rejected:_ deep-import-only schema coverage.

## Referenced by

[[schema-index]] · [[schema/_MOC]] · [[src/_MOC]]
