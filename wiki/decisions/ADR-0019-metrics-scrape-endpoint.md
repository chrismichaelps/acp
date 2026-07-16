---
type: decision
status: ACCEPTED
date: 2026-07-15
tags: [adr, accepted, http, observability, metrics, contract]
aliases: [ADR-0019, metrics-scrape-endpoint]
---

# ADR-0019 — Expose a Prometheus Scrape Endpoint

## Status

ACCEPTED for issue #330.

## Context

ACP already collects structured telemetry at every boundary — native RPC
completions in [[acp-rpc-telemetry-middleware]], HTTP latency through `respond`,
and background retention sweeps in the sweeper — and writes it to the structured
log line. Operators can read those facts after the fact, but there is no live
numeric surface a monitoring system can scrape, so there is nothing to alert on
and no latency distribution to watch.

The `/health` and `/ready` probes are unauthenticated liveness signals; metrics
are different. They quantify traffic shape and error composition, so exposing
them by default would leak operational detail, and a scrape happens before any
session exists so it cannot use the `/v1` session-scope model.

## Decision

### Projection, not new instrumentation

[[metrics]] renders the existing Effect metric registry snapshot as
[Prometheus text](https://prometheus.io/docs/instrumentation/exposition_formats/)
at `GET /metrics`. Nothing new is instrumented; the endpoint is a projection of
the same `operation`, `outcome`, `duration`, and `error_code` facts already
recorded elsewhere. The renderer has no Prometheus client-library dependency — it
serializes the registry snapshot directly.

### Off by default, token-gated

`ACP_METRICS_TOKEN` both enables and secures the endpoint. Unset, `/metrics`
answers `404`, so metrics are never exposed by accident. Set, a scrape must
present `Authorization: Bearer <token>`; a missing or wrong token answers `401`.
This is a static scrape credential, not a session token: Prometheus scrapes
before any session exists, so `/metrics` sits outside the session-scope model of
the `/v1` API and outside the [[ADR-0015-trusted-session-issuance]] hostile-client
boundary.

### The series are a contract

The exposed series — RPC request/error counters and a duration histogram, HTTP
request counter and duration histogram, sweeper eviction/prune counters, and a
`acp_build_info` gauge — are a deliberate scrape contract because alerting rules
depend on them. The set grows additively; a series is not renamed or removed
while operators may have rules bound to it. Durations are emitted in seconds, the
Prometheus convention, even though the sources measure milliseconds. `/metrics`
excludes its own request from `acp_http_requests_total`.

## Rationale

Projecting the existing registry keeps one source of truth for telemetry and
avoids a second measurement path that could drift from the logs. Off-by-default
plus a static bearer matches the posture Prometheus actually scrapes with and
prevents accidental exposure of traffic and error composition. Naming the series
a contract makes alerting rules durable instead of coupled to incidental output.

## Consequences

- Operators get live counters, error composition by ACP error code, and p99
  latency distributions for both RPC and HTTP without any new instrumentation.
- The series set is a compatibility surface: additions are safe, renames and
  removals are breaking for existing alert rules and are avoided within a
  protocol version.
- A deployment that wants metrics must provision and rotate `ACP_METRICS_TOKEN`;
  leaving it unset is a safe default, not a misconfiguration.
- The endpoint exposes operational shape (request rates, error codes, latency),
  never ACP workspace data or credentials.

## Alternatives

**Expose `/metrics` unauthenticated like `/health`** — rejected because metrics
quantify traffic and error composition, which is operational detail a liveness
probe does not carry.

**Add a Prometheus client library and re-instrument** — rejected because ACP
already collects the facts; a second path would drift from the structured logs.

**Emit milliseconds to match the sources** — rejected because Prometheus
tooling, `histogram_quantile`, and dashboards assume seconds.

## Validation

Acceptance requires unit tests over the Prometheus renderer, route tests proving
the `404`-when-unset, `401`-on-bad-token, and `200`-with-bearer auth posture, the
`.env.example` completeness gate, and the full typecheck/lint/format/suite gate;
plus README observability documentation and the [[metrics]] contract reference.

## Grill Log

- **Q:** Why is `/metrics` `404` when unset rather than `401`? **A:** A `404`
  reveals nothing about whether metrics exist; the endpoint is genuinely absent
  until an operator opts in with `ACP_METRICS_TOKEN`. _Rejected:_ always-present
  `/metrics` that advertises a protected surface operators never enabled.
- **Q:** Can the series set change freely between releases? **A:** No; alerting
  rules bind to series names, so the set grows additively and names are stable
  within a protocol version. _Rejected:_ treating the exposition as incidental
  output with no compatibility promise.
