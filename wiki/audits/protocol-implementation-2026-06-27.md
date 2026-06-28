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
became necessary for parity with implemented domain behavior: workspace
create/update/archive, work progress event publication, review
approve/reject/request-changes, and artifact deletion. `session.initialize`
accepts the draft §9 capability shape and the earlier full-worker shape, then
returns the spec response with `protocol_version`, host descriptor, host
capabilities, and bearer session id.

The JSON-RPC surface covers spec §13 and the same backed parity extensions:
`workspace.create`, `workspace.update`, `workspace.archive`,
`work.publish_event`, `review.approve`, `review.reject`,
`review.request_changes`, and `artifact.delete`. JSON-RPC runs through the shared
mapper/runtime, `POST /rpc`, and stdio Content-Length bridge. WebSocket is
deferred by [[ADR-0002-json-rpc-transport-framing]].

The event vocabulary is now governed by
[[ADR-0003-event-vocabulary-domain-boundaries]]. Public events are emitted only
from persisted domain transitions. Workspace archive is backed by persisted
workspace lifecycle state. Worker presence and artifact update remain design work
because their domain state is not defined.

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

The repository now has a GitHub Actions CI workflow for pull requests and pushes
to `main`. It runs Node 24 with the lockfile-backed pnpm setup, then enforces
lint, format check, typecheck, file-size, and tests. The previous repo-wide
formatting drift has been normalized in a dedicated mechanical cleanup.

Version negotiation now has an explicit [[protocol-version]] module and
[[ADR-0004-protocol-version-codecs-generated-client]] records why standalone
codecs and generated clients remain deferred. There is still no
`src/protocol/codecs` folder because no public route exposes Effect collections
outside schema-owned JSON boundaries, and no generated-client output because no
external SDK consumer or artifact policy exists yet. `src/infrastructure/platform-node`
also remains uncreated because current Node-specific wiring is still small and
isolated in app entrypoints.

## Next Slice

Continue with the next command/domain gap from the protocol audit. Artifact
update and worker presence remain deferred until their persisted domain state is
defined. Codecs and generated clients should only re-enter the queue when a
concrete boundary or consumer appears; platform-node extraction should wait for
more than one Node adapter or duplicated platform wiring. The JSON-RPC command
map has been split into a focused method table plus [[json-rpc-command-support]],
restoring file-size headroom before future method growth.

## Referenced by

[[architecture/_MOC]] · [[protocol-coverage-2026-06-27]] ·
[[spec-canonicalization]]
