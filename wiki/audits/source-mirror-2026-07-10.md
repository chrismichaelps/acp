---
type: audit
date: 2026-07-10
status: OPEN
tags: [audit, wiki, mirror]
aliases: [source-mirror-2026-07-10]
---

# Source Mirror Audit — 2026-07-10

## Scope

Compare every `@root/src/**/*.ts` file with the exact FMCF mirror path
`@root/wiki/src/**/*.md`, including production modules and tests. Then reverse the
mapping to find orphaned wiki pages.

## Evidence

| Measure                    | Count |
| -------------------------- | ----: |
| TypeScript source files    |   250 |
| Non-MOC source wiki pages  |   166 |
| Missing mirrors            |    84 |
| Missing production/support |     0 |
| Missing tests              |    84 |
| Orphaned pages             |     0 |

Missing mirrors by source area: `app` 36 · `config` 1 · `domain` 13 ·
`infrastructure` 29 · `protocol` 5.

## Production / Support Hard-Lock

These modules are `UNREGISTERED` and cannot be changed until distilled:

1. `@root/src/app/cli/cli-dogfood-support.ts`
2. `@root/src/app/cli/gh-bridge-support.ts`
3. `@root/src/app/cli/gh-reconcile.ts`
4. `@root/src/app/server/health-routes.ts`
5. `@root/src/domain/grills/index.ts`
6. `@root/src/domain/review-comments/index.ts`
7. `@root/src/infrastructure/events/index.ts`
8. `@root/src/infrastructure/http/acp-http-api-resume.ts`
9. `@root/src/infrastructure/rpc/acp-rpc-test-support.ts`

## Repaired Orphaned Pages

Four RPC roundtrip pages used `-test.md` while source uses `.test.ts`:

- `acp-rpc-roundtrip-artifact-checkpoint.test.md`
- `acp-rpc-roundtrip-review-memory-event.test.md`
- `acp-rpc-roundtrip.test.md`
- `acp-rpc-roundtrip-work-lease.test.md`

Each now uses the exact `.test.md` mirror path. The legacy `-test` name remains
an alias so existing external wiki references degrade safely, while repository
links target the canonical dotted name.

## Selected Sequence

1. **Production parity:** distill the nine hard-locked modules and update their
   folder MOCs/backlinks.
2. **RPC orphan repair:** rename four pages to exact `.test.md` paths.
3. **Test parity batches:** app/config, domain, infrastructure, then protocol;
   keep each review slice below the normal review-size threshold.
4. **Enforcement:** after parity reaches zero missing/orphaned files, design a CI
   mirror check in the wiki first, then project it to tooling.

No implementation code is authorized during steps 1–3; these are restoration of
the constitutional wiki registry.

## Progress

- ✅ Production parity: all nine production/support pages distilled with domain
  vocabulary, MOCs, linkage, negative logic, depth, and Grill Logs.
- ✅ RPC orphan repair: four roundtrip pages renamed to exact `.test.md` mirrors;
  old names retained as aliases and all repository backlinks reconciled.
- Current audit: 84 missing mirrors, all tests; 0 missing production/support; 0
  orphaned pages.
- Next: distill the four app/config boundary tests (`app-live`, `logging`, stdio
  frames, and app config) as the first bounded test-parity batch.

## Grill Log

- **Q:** Do test files require mirrors? **A:** Yes. FMCF's 1:1 law says every
  `src` source file, and tests encode behavior required to rebuild the system.
  _Rejected:_ production-only mirroring (leaves executable contracts invisible).
- **Q:** Should all 97 pages land in one change? **A:** No. Restore the nine
  production modules first, then bounded test batches. _Rejected:_ one bulk dump
  (unreviewable and likely shallow distillation).
- **Q:** Should orphaned RPC pages be deleted? **A:** Rename and reconcile them;
  their content remains valuable but their paths violate deterministic lookup.
  _Rejected:_ delete/recreate (unnecessary history and link loss).
- **Q:** Should code enforcement be added immediately? **A:** No. First make the
  vault compliant, then document and implement a zero-drift check. _Rejected:_ add
  a failing CI gate before the repair sequence exists.

## Referenced by

[[audits/_MOC]] · [[architecture/_MOC]] · [[00-INDEX]]
