---
date: 2026-07-10
topic: source-mirror-parity
from_role: Forensic Guardian
to_role: DNA Engineer
status: IN_PROGRESS
maturity: EXPLORING
tags: [handoff]
---

# Handoff — Source Mirror Parity

## Done

- Measured [[source-mirror-2026-07-10]]: initial 250 source files, 157 mirrored
  pages, 97 missing, and 4 orphaned pages.
- Distilled all 9 unregistered production/support modules; missing production is
  now zero and total missing is 88 (all tests).
- Defined [[Host]], [[Grill]], and [[ReviewComment]] and added missing Audits,
  Grills, and Review Comments MOCs.
- Reconciled affected CLI, server, domain, events, HTTP, RPC, router, and API
  linkage. Exact path audit and Prettier pass.
- Renamed the four RPC roundtrip pages to exact `.test.md` mirror paths,
  retained their legacy `-test` aliases, and reconciled repository backlinks.
  The bidirectional audit now reports 84 missing test mirrors and 0 orphans.
- Distilled the app layer, logging, stdio frame, and config executable contracts;
  added `config/_MOC` and reconciled source/module backlinks. The audit now
  reports 80 missing test mirrors and 0 orphans.

## Decided (do not re-litigate)

- Tests require 1:1 mirrors because they are executable behavior contracts.
- Repair the four RPC orphan paths before authoring new test pages.
- Land remaining test parity in bounded area-based slices, not one bulk dump.
- Add a CI mirror check only after missing/orphan counts reach zero.

## Open / Remaining

- 80 missing test mirrors: app 33, domain 13, infrastructure 29, and protocol 5.

## Exact next action

DNA Engineer: read and distill the first bounded foundational CLI test batch:

1. `@root/src/app/cli/client.test.ts`
2. `@root/src/app/cli/command-registry.test.ts`
3. `@root/src/app/cli/commands.test.ts`
4. `@root/src/app/cli/event-commands.test.ts`
5. `@root/src/app/cli/lease-commands.test.ts`
6. `@root/src/app/cli/work-commands.test.ts`

Update the CLI MOC and source backlinks, then rerun the bidirectional path audit.
Expected result: 74 missing tests and 0 orphans.

## Links

[[source-mirror-2026-07-10]] · [[architecture/_MOC]] · [[rpc/_MOC]] ·
[[grammar/typescript]]
