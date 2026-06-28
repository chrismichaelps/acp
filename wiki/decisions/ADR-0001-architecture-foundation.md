---
type: adr
status: ACCEPTED
date: 2026-06-25
tags: [adr]
aliases: [ADR-0001, ADR-0001-architecture-foundation]
---

# ADR-0001 — Architecture Foundation

## Status

ACCEPTED — 2026-06-25.

## Context

First reference implementation of the protocol (spec §16). Greenfield repo with
TypeScript + Effect + `@effect/platform` toolchain already pinned. Maturity:
**EXPLORING** (<20k LOC, new, solo) — ceremony stays lean per FMCF Section IV.

## Problem

Establish the canonical name, the layer/seam topology, and the storage strategy
before writing protocol code, so every later slice projects from a stable base.

## Decision

1. **Name — Agent Coordination Protocol (ACP).** The spec's supersession note is
   authoritative: ACP replaces the prior "Hadoof"/"AWP" drafts. All identifiers,
   env prefixes (`ACP_`), URI scheme (`acp://`), and token prefix (`acp_`) use ACP.
2. **Effect Layer topology** per spec §16.3:
   `Config → Logger → Storage(seam) → EventStore → {domain services} → Transport(seam) → {Http, SSE}`.
3. **Storage is a seam** ([[Storage]]) with an InMemory production adapter first and
   SQLite as the committed second adapter (spec §17). No `@effect/sql` dependency is
   added until the SQLite slice; v0.1 ships InMemory.
4. **Transport is a seam** ([[Transport]]): HTTP+SSE in v0.1 via `@effect/platform`
   `HttpApi` declarative builder; JSON-RPC deferred to v0.2.
5. **Schema-first:** every protocol payload is an Effect `Schema` in
   `wiki/src/protocol/schema/`; schemas are the single source of truth for types
   and (later) OpenAPI.

## Rationale

- ACP name: non-negotiable per spec; recorded so the Hadoof references in older
  spec sections are read as historical.
- Declarative `HttpApi` over raw `HttpRouter`: gives typed endpoints, automatic
  OpenAPI, and centralized error mapping — senior-correct and matches spec §16.8's
  "not a collection of untyped route handlers" mandate.
- InMemory-first storage: lets the full protocol be exercised and tested with zero
  native deps; SQLite slots behind the same seam interface with no domain changes.

## Consequences

- Domain/protocol code must never import Node built-ins (enforced via
  [[grammar/typescript]] Prohibited Patterns).
- A second storage adapter (SQLite) promotes [[Storage]] toward BACKBONE later.
- `ACP_` env vars must each have a typed `Config` (spec §16.5).

## Alternatives

- Raw `HttpRouter` handlers — rejected: untyped, manual error mapping, no OpenAPI.
- SQLite from day one — rejected: adds native build complexity for EXPLORING maturity
  with no behavioral gain; the seam makes deferral free.
- Keeping the "Hadoof" name — rejected: contradicts the spec's canonical-name rule.

## Validation

- Predicted: InMemory adapter + schema layer ship with `pnpm typecheck` + `pnpm test`
  green and zero `any`.
- Actual: (recorded at review) — schema slice + config: see [[CHANGELOG]].
- Review date: at SQLite adapter slice (validate seam held with zero domain edits).

## Referenced by

[[Storage]] · [[Transport]] · [[EventStream]] · [[architecture/_MOC]] ·
[[spec-canonicalization]]
