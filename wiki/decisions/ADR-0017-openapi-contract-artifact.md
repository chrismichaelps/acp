---
type: decision
status: ACCEPTED
date: 2026-07-14
tags: [adr, accepted, http, contract, tooling]
aliases: [ADR-0017, openapi-contract-artifact]
---

# ADR-0017 — Publish an OpenAPI Contract Artifact

## Status

ACCEPTED for issue #327.

## Context

The REST surface is defined once as typed `@effect/platform` `HttpApi` groups in
[[acp-http-api]]. That declaration is authoritative for the running host, but it
is only directly consumable by TypeScript readers. Other-language client
generators, API explorers, and adopters need a standard machine-readable
contract.

[[ADR-0004-protocol-version-codecs-generated-client]] deferred client generation
until a concrete consumer and stable artifact policy existed. External REST
clients are now the consumer; this decision establishes the artifact policy.

## Decision

### Generated contract

[[openapi-module]] derives an OpenAPI 3.1 document from `AcpHttpApi` through
`OpenApi.fromApi`, pins ACP identity metadata, and serializes one canonical JSON
representation. The generated `openapi.json` is committed at the repository root.
`pnpm openapi:generate` rebuilds the source projection and rewrites the artifact;
`pnpm check:openapi` and the normal test suite compare it byte-for-byte with the
current typed contract.

The running [[acp-router]] serves the same in-memory projection, without auth, at
`GET /openapi.json` through [[openapi-route]]. It never reads the repository file
at request time and computes the immutable document once per process.

### Authentication description

The generated Effect document does not know about the router's custom bearer
authorization layer, so [[openapi-module]] adds an `AcpSession` HTTP bearer
security scheme and applies it to every declared REST operation except
`session.initializeSession`. That bootstrap operation remains public because it
mints the session id. Local profiles may set `ACP_REQUIRE_AUTH=false`; this is a
deployment relaxation, not the production contract advertised to generated
clients. The bearer is the current caller-selected v0.1 session id and does not
claim trusted public identity; [[ADR-0015-trusted-session-issuance]] remains the
hostile-client boundary.

### 0.x stability envelope

`info.version` is `ACP_PROTOCOL_VERSION`, not the package release. While that
value is unchanged, ACP does not remove or rename an operation id, method, path,
documented success status, required request field, response field, enum member,
or security requirement, and does not narrow an accepted value or change its
meaning incompatibly. Additive operations and optional fields may remain within
the same protocol version when older clients can safely ignore them.

Any incompatible OpenAPI change requires an explicit protocol-version decision
through [[version-bump]] before merge. During protocol `0.y`, both the tool's
`major` and `minor` protocol intents advance `y`; the distinction is still
recorded as operator intent even though the two-part wire version has no patch
slot. The generated diff is review evidence, not permission to bypass that
decision.

Native Effect RPC retains its own schema contract and is outside this artifact.
Generated language-specific clients remain downstream work rather than generated
files committed by this issue.

## Rationale

Deriving from the typed routes keeps one source of truth. Committing the stable
serialization makes adoption and contract review possible without installing the
toolchain. Explicit security repair prevents generated clients from falsely
assuming protected operations are anonymous. The 0.x envelope makes the
published artifact a deliberate compatibility promise instead of a large JSON
snapshot with no governance.

## Consequences

- REST changes that alter the artifact require intentional regeneration and a
  reviewable diff.
- Generated clients can configure ACP bearer sessions from standard OpenAPI
  security metadata.
- The checked-in artifact is large, but it is isolated mechanical output and is
  excluded from Prettier; its byte representation is owned by
  `serializeOpenApi`.
- The unauthenticated discovery endpoint exposes schemas and routes, never ACP
  workspace data or credentials.
- Hosted identity remains explicitly unresolved until
  [[ADR-0015-trusted-session-issuance]].

## Alternatives

**Hand-write OpenAPI YAML** — rejected because it creates a second route/schema
source that can drift.

**Generate only during deployment** — rejected because evaluators and reviewers
need an artifact without a running host.

**Publish the raw Effect document with empty security arrays** — rejected because
the runtime authorizes those operations and client generators would omit bearer
support.

**Version the artifact with package semver** — rejected because client
compatibility follows the wire contract, not internal release cadence.

## Validation

Acceptance requires structure, identity, route, security, bootstrap exemption,
determinism, stale-artifact, and live unauthenticated route tests; exact source/
wiki mirror parity; typecheck, lint, formatting, policies, full suite, production
build, Docker self-dogfood, and an ACP grill/review gate attached to PR #332.

## Grill Log

- **Q:** Can the raw `OpenApi.fromApi` output be published unchanged? **A:** No;
  add the router's bearer security model and keep only session initialization
  public. _Rejected:_ empty security arrays that contradict hardened runtime
  behavior.
- **Q:** What is stable inside protocol 0.x? **A:** Same-version consumers keep
  operation identity, required inputs, response shape, enums, statuses, security,
  and meaning; incompatible changes advance the protocol version. _Rejected:_
  treating every 0.x commit as freely breaking.
- **Q:** Should the endpoint read `openapi.json` from disk? **A:** No; serve the
  deterministic in-memory projection computed once. _Rejected:_ runtime
  filesystem coupling and possible artifact/source split-brain.
- **Q:** Is the 10k-line artifact too large for review? **A:** Keep it as isolated
  mechanical output and require byte drift checks plus focused semantic tests.
  _Rejected:_ hiding the contract in CI artifacts only.
- **Q:** Does bearer metadata mean ACP is safe for hostile public clients?
  **A:** No; it describes the current session mechanism while explicitly linking
  the trusted-issuance backlog. _Rejected:_ overstating the v0.1 identity model.

## Referenced by

[[ADR-0004-protocol-version-codecs-generated-client]] · [[architecture/_MOC]] ·
[[decisions/_MOC]] · [[openapi-module]] · [[openapi-module.test]] ·
[[openapi-route]] · [[openapi]] · [[Transport]] ·
[[2026-07-14-openapi-contract]] · [[CHANGELOG]]
