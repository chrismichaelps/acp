---
type: audit
date: 2026-06-27
tags: [audit, protocol, implementation]
aliases: [protocol-implementation-2026-06-27, fresh-protocol-audit-2026-06-27]
---

# Protocol Implementation Audit — 2026-06-27

## Scope

This audit replaces the stale next-action list from
[[protocol-coverage-2026-06-27]] after the JSON-RPC progress, review action,
session capability negotiation, artifact delete, event-boundary, and naming
canonicalization slices. It compares the tracked ACP implementation against the
current interpretation of `@root/specs.md`, using [[spec-canonicalization]] for
the Hadoof-era draft language.

## Current Coverage

The protocol object model is implemented in `src/protocol/schema` for Worker,
Workspace, WorkUnit, Lease, Artifact, Checkpoint, Review, Event, identifiers,
common vocabularies, sessions, and protocol errors. Domain services exist for
the stateful protocol capabilities and are composed through [[app-live]] with
swappable [[Storage]], an append-only [[event-store]], and transport adapters at
the edge.

The HTTP surface covers the spec §12 command set plus backed extensions that
became necessary for parity with implemented domain behavior: work progress
event publication, review approve/reject/request-changes, and artifact deletion.
`session.initialize` accepts the draft §9 capability shape and the earlier
full-worker shape, then returns the spec response with `protocol_version`, host
descriptor, host capabilities, and bearer session id.

The JSON-RPC surface covers spec §13 and the same backed parity extensions:
`work.publish_event`, `review.approve`, `review.reject`,
`review.request_changes`, and `artifact.delete`. JSON-RPC runs through the shared
mapper/runtime, `POST /rpc`, and stdio Content-Length bridge. WebSocket is
deferred by [[ADR-0002-json-rpc-transport-framing]].

The event vocabulary is now governed by
[[ADR-0003-event-vocabulary-domain-boundaries]]. Public events are emitted only
from persisted domain transitions. Worker presence, workspace archive, and
artifact update remain design work because their domain state is not defined.

## Implementation Standards

The repo has the required Node 24 marker (`.nvmrc` contains `24`), package
metadata, lockfile, TypeScript config, Prettier config, README, Apache-2.0
license, and local scripts for build, lint, format, format check, typecheck, and
tests. The project uses `eslint.config.js` rather than the draft's
`eslint.config.ts`; that is acceptable for the current toolchain but should stay
documented as an implementation variance.

The source tree follows the actual ACP layering rather than the older draft's
illustrative `apps/` folder names: `src/app`, `src/domain`, `src/protocol`, and
`src/infrastructure`. This matches the wiki mirror and accepted architecture,
even where the ignored draft still shows early folder names.

## Gaps

The file-size rule is now enforced locally. Spec §16.9 sets a 500-line ceiling
and recommends a `check:file-size` gate; this repo now has `npm`/package script
coverage through `check:file-size`, backed by `scripts/check-file-size.mjs`.
The previous oversized `src/infrastructure/jsonrpc/json-rpc.ts` module has been
split into a 111-line facade plus a 427-line [[json-rpc-command-map]] module.

The repository does not yet have CI enforcing the local gates. `.github/` only
contains funding metadata, while spec §16.10 expects linting and formatting to
be enforced in CI. The local scripts now exist for build, lint, format check,
typecheck, test, and file-size enforcement; a CI slice can wire them without
adding new package-management behavior.

Some draft folder names and optional implementation folders remain intentionally
uncreated. There is no `src/protocol/version.ts`, `src/protocol/codecs`, or
`src/infrastructure/platform-node` folder yet because version negotiation,
external codecs, and platform-specific seams are still represented by smaller
current modules. These are not blocking v0.1 behavior, but they should be
revisited when generated clients or multiple platform adapters appear.

## Next Slice

Add CI enforcement for the existing local gates. The next slice should create a
GitHub Actions workflow for Node 24 that runs lint, typecheck, file-size, and
tests without performing package installation churn beyond the lockfile-backed
setup the repo already uses.

## Referenced by

[[architecture/_MOC]] · [[protocol-coverage-2026-06-27]] ·
[[spec-canonicalization]]
