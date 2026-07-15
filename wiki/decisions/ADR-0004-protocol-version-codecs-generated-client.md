---
type: adr
status: ACCEPTED
date: 2026-06-27
tags: [adr, protocol, versioning]
aliases: [ADR-0004, ADR-0004-protocol-version-codecs-generated-client]
---

# ADR-0004 — Protocol Version, Codecs, and Generated Client Surface

## Status

ACCEPTED — 2026-06-27.

## Context

The fresh implementation audit identified three draft folders that were still
uncreated: `src/protocol/version.ts`, `src/protocol/codecs`, and generated client
output. All three are mentioned by the Hadoof-era draft, read through
[[spec-canonicalization]] as ACP, but they do not have equal value in the current
reference host.

Session initialization already carries `protocol_version` in the request and
response. The router previously enforced the only supported version indirectly
through a schema literal, which meant future version strings failed as generic
decode errors before the handshake had a named compatibility boundary.

Generic collection codecs are not yet needed outside schema-owned transport
edges. The current wire payloads use JSON-native records and arrays, while
Effect structures such as `Option` are already handled inside the schema modules
that expose them. A standalone `src/protocol/codecs` folder would be mostly
ceremony until a protocol object exposes `HashMap`, `HashSet`, `Chunk`, or
non-schema `Option` conversion across a public boundary.

Generated clients are similarly premature. [[acp-http-api]] is already the
typed contract source for REST routes, but no external SDK package, OpenAPI
artifact, or multi-language consumer exists yet. Checking in generated output
before the public contract stabilizes would add review noise and a second source
of drift.

## Decision

ACP v0.1 creates `src/protocol/version.ts` now and treats protocol version
compatibility as explicit handshake logic. The module owns
`ACP_PROTOCOL_VERSION`, the supported-version set, the protocol-version schema,
and the pure compatibility predicate.

`InitializeSessionPayload` decodes `protocol_version` as a string with a default
of the current version. The server router rejects unsupported values during
`POST /v1/session/initialize` with the normal ACP `invalid_request` validation
error. Successful
responses always echo `ACP_PROTOCOL_VERSION`.

`src/protocol/codecs` remains deferred until a real public boundary requires
standalone conversion for Effect collections. Generated client output remains
deferred until there is a concrete consumer and a stable artifact policy.

## Rationale

Version negotiation is already part of the public session contract, so it should
have a named protocol module instead of being repeated as string literals across
HTTP and router code. Keeping unsupported versions as a runtime compatibility
decision also mirrors adjacent protocol practice: the handshake accepts a client
claim and then decides whether the host can serve it.

Codec modules should exist when they hide real boundary complexity. Creating
them before any protocol route exposes those structures would make shallow
modules that callers must learn without gaining behavior. The schema modules are
currently the right place for JSON conversion.

Generated clients should be downstream of a stable contract. The current
reference host is still tightening command parity and event vocabulary; generated
artifacts would amplify every small route or schema decision before the consumer
exists.

### Update — 2026-07-14

[[ADR-0017-openapi-contract-artifact]] now supplies the concrete REST consumer,
stable artifact policy, protocol-versioned compatibility envelope, security
metadata, and drift gate that this decision required. Language-specific generated
client packages remain downstream; the committed OpenAPI document is the stable
input to that future work.

## Consequences

Protocol-version constants are no longer hard-coded into the router response or
session payload default. Future compatibility work can add supported versions in
one module and expand the handshake tests around it.

The next implementation slices should not add `src/protocol/codecs` or generated
client files unless they first introduce a concrete public structure or consumer
that needs them. The audit can treat those folders as accepted deferrals rather
than unresolved gaps.

## Alternatives

Keep `protocol_version` as a schema literal only — rejected: it catches the value
but hides the compatibility decision inside generic decoding and encourages
duplicated string literals.

Create empty codec wrappers now — rejected: the current schemas already own the
JSON boundary, and empty wrappers would be shallow pass-throughs.

Check in generated clients from the current `HttpApi` surface — rejected: no
consumer, artifact policy, or review process exists yet, so generated files would
increase churn without improving interoperability.

## Validation

The slice is validated by protocol-version unit tests, HTTP contract tests that
keep future version strings decodable, router tests that reject unsupported
versions as ACP `invalid_request` errors, and the full local gate.

## Referenced by

[[architecture/_MOC]] · [[protocol-implementation-2026-06-27]] ·
[[acp-http-api]] · [[protocol-version]] ·
[[ADR-0017-openapi-contract-artifact]]
