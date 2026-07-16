/** @Acp.Infra.Metrics.Instruments — the exposed metric contract */
import { Effect, Metric, MetricBoundaries } from 'effect'
import { ACP_PROTOCOL_VERSION } from '../../protocol/schema/index.js'

// The set of instruments below is the scrape contract. Adding or removing a
// series is a breaking change for anyone alerting on it, so the vocabulary is
// deliberately small: it re-exports telemetry we already collect (native RPC
// completions, HTTP boundary latency, and background sweeper eviction) rather
// than instrumenting anything new. Durations are seconds — the Prometheus
// convention — even though the sources measure milliseconds.

// Latency buckets in seconds. The Prometheus client defaults, which cover the
// sub-millisecond-to-ten-second range RPC and HTTP calls actually land in.
const latencyBoundaries = MetricBoundaries.fromIterable([
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
])

const rpcRequestsTotal = Metric.counter('acp_rpc_requests_total', {
  description: 'Native RPC requests completed, by operation and outcome.',
})

const rpcErrorsTotal = Metric.counter('acp_rpc_errors_total', {
  description: 'Native RPC failures, by operation and protocol error code.',
})

const rpcRequestDurationSeconds = Metric.histogram(
  'acp_rpc_request_duration_seconds',
  latencyBoundaries,
  'Native RPC request duration in seconds, by operation.',
)

const httpRequestsTotal = Metric.counter('acp_http_requests_total', {
  description: 'HTTP requests completed, by method, route, and status.',
})

const httpRequestDurationSeconds = Metric.histogram(
  'acp_http_request_duration_seconds',
  latencyBoundaries,
  'HTTP request duration in seconds, by method and route.',
)

const sweepEventsPrunedTotal = Metric.counter('acp_sweep_events_pruned_total', {
  description: 'Events deleted by the retention sweeper.',
  incremental: true,
})

const sweepSessionsEvictedTotal = Metric.counter(
  'acp_sweep_sessions_evicted_total',
  {
    description: 'Sessions evicted by the sweeper after TTL expiry.',
    incremental: true,
  },
)

const sweepLeasesExpiredTotal = Metric.counter(
  'acp_sweep_leases_expired_total',
  {
    description: 'Leases lapsed by the sweeper after their deadline.',
    incremental: true,
  },
)

const buildInfo = Metric.gauge('acp_build_info', {
  description:
    'Build and protocol identity. Always 1; read the labels, not the value.',
})

const MS_PER_SECOND = 1000

/** Record one native RPC completion. Called from the RPC telemetry middleware. */
export const recordRpcCompletion = (input: {
  readonly operation: string
  readonly outcome: 'success' | 'failure'
  readonly durationMs: number
  readonly errorCode?: string
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Metric.update(
      rpcRequestsTotal.pipe(
        Metric.tagged('operation', input.operation),
        Metric.tagged('outcome', input.outcome),
      ),
      1,
    )
    yield* Metric.update(
      rpcRequestDurationSeconds.pipe(
        Metric.tagged('operation', input.operation),
      ),
      input.durationMs / MS_PER_SECOND,
    )
    if (input.errorCode !== undefined) {
      yield* Metric.update(
        rpcErrorsTotal.pipe(
          Metric.tagged('operation', input.operation),
          Metric.tagged('error_code', input.errorCode),
        ),
        1,
      )
    }
  })

/** Record one HTTP boundary completion. Called from `respond`. */
export const recordHttpCompletion = (input: {
  readonly method: string
  readonly route: string
  readonly status: number
  readonly durationMs: number
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Metric.update(
      httpRequestsTotal.pipe(
        Metric.tagged('method', input.method),
        Metric.tagged('route', input.route),
        Metric.tagged('status', String(input.status)),
      ),
      1,
    )
    yield* Metric.update(
      httpRequestDurationSeconds.pipe(
        Metric.tagged('method', input.method),
        Metric.tagged('route', input.route),
      ),
      input.durationMs / MS_PER_SECOND,
    )
  })

/** Record the outcome of one sweeper pass. Called from `sweepOnce`. */
export const recordSweep = (input: {
  readonly prunedEvents: number
  readonly evictedSessions: number
  readonly expiredLeases: number
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Metric.update(sweepEventsPrunedTotal, input.prunedEvents)
    yield* Metric.update(sweepSessionsEvictedTotal, input.evictedSessions)
    yield* Metric.update(sweepLeasesExpiredTotal, input.expiredLeases)
  })

/**
 * Pin the build-info series to 1 with the current version labels. Called on
 * each scrape so the series exists even before any request is served.
 */
export const recordBuildInfo: Effect.Effect<void> = Metric.set(
  buildInfo.pipe(Metric.tagged('protocol_version', ACP_PROTOCOL_VERSION)),
  1,
)
