---
type: reference
tags: [reference, http, observability, metrics]
aliases: [metrics, prometheus, scrape]
---

# Metrics (`GET /metrics`)

ACP exports the structured telemetry it already collects — native RPC
completions, HTTP boundary latency, and background retention sweeps — as
[Prometheus text](https://prometheus.io/docs/instrumentation/exposition_formats/)
at `GET /metrics`. Nothing new is instrumented; the endpoint is a projection of
the same `operation`, `outcome`, `duration`, `error_code` facts already written
to the structured log line in [[acp-rpc-telemetry-middleware]] and `respond`.

## Auth posture

Unlike the `/health` and `/ready` probes, `/metrics` is **off by default**. The
`ACP_METRICS_TOKEN` variable both enables and secures it:

- **unset** — the endpoint answers `404`, so metrics are never exposed by
  accident.
- **set** — a scrape must present `Authorization: Bearer <token>`. A missing or
  wrong token answers `401`.

This is a static scrape credential, not a session token: Prometheus scrapes
before any session exists, so `/metrics` sits outside the session-scope model of
the `/v1` API. Configure Prometheus with the matching `authorization.credentials`
scrape option.

```yaml
scrape_configs:
  - job_name: acp
    authorization:
      credentials: <ACP_METRICS_TOKEN>
    static_configs:
      - targets: ['acp-host:4317']
```

## The exposed series (a contract)

The series below are a scrape contract: alerting rules depend on them, so the set
grows deliberately. Durations are seconds — the Prometheus convention — even
though the sources measure milliseconds.

| Metric                              | Type      | Labels                      | Meaning                                               |
| ----------------------------------- | --------- | --------------------------- | ----------------------------------------------------- |
| `acp_rpc_requests_total`            | counter   | `operation`, `outcome`      | Native RPC calls completed.                           |
| `acp_rpc_errors_total`              | counter   | `operation`, `error_code`   | RPC failures, by ACP protocol error code.             |
| `acp_rpc_request_duration_seconds`  | histogram | `operation`                 | RPC latency.                                          |
| `acp_http_requests_total`           | counter   | `method`, `route`, `status` | HTTP requests completed (excludes `/metrics` itself). |
| `acp_http_request_duration_seconds` | histogram | `method`, `route`           | HTTP boundary latency.                                |
| `acp_sweep_events_pruned_total`     | counter   | —                           | Events deleted by the retention sweeper.              |
| `acp_sweep_sessions_evicted_total`  | counter   | —                           | Sessions evicted after TTL expiry.                    |
| `acp_sweep_leases_expired_total`    | counter   | —                           | Leases lapsed after their deadline.                   |
| `acp_build_info`                    | gauge     | `protocol_version`          | Always `1`; read the labels, not the value.           |

Histograms expand into the usual cumulative `_bucket{le=...}`, `_sum`, and
`_count` families. Latency buckets are the Prometheus client defaults
(`0.005 … 10` seconds).

## What is worth watching

- **RPC error rate** — `rate(acp_rpc_errors_total[5m])` broken down by
  `error_code`, or the ratio of `acp_rpc_requests_total{outcome="failure"}` to
  all completions. A rising `internal_error` share is the strongest "something is
  wrong" signal.
- **Latency** — the `_bucket` series feed
  `histogram_quantile(0.99, ...)`; watch p99 for both RPC and HTTP.
- **Retention health** — if `acp_sweep_events_pruned_total` stays flat while the
  event log keeps growing, the sweeper is not keeping up (or `ACP_EVENT_RETENTION_DAYS`
  is `0`, which disables pruning). See [[operational-contracts]].
- **Traffic shape** — `acp_http_requests_total` by `status` surfaces a spike in
  `4xx`/`5xx` before users report it.

## Referenced by

[[00-INDEX]] · [[operational-contracts]]
