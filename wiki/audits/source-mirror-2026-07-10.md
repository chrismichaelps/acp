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
| Non-MOC source wiki pages  |   157 |
| Missing mirrors            |    97 |
| Missing production/support |     9 |
| Missing tests              |    88 |
| Orphaned pages             |     4 |

Missing mirrors by source area: `app` 40 · `config` 1 · `domain` 15 ·
`infrastructure` 36 · `protocol` 5.

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

## Orphaned Pages

Four RPC roundtrip pages use `-test.md` while source uses `.test.ts`:

- `acp-rpc-roundtrip-artifact-checkpoint-test.md`
- `acp-rpc-roundtrip-review-memory-event-test.md`
- `acp-rpc-roundtrip-test.md`
- `acp-rpc-roundtrip-work-lease-test.md`

Rename each to the exact `.test.md` mirror path and update its aliases/links; do
not delete the distilled content.

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
