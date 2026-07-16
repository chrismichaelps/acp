/** @Acp.Infra.Metrics.Prometheus.Test — scrape-text rendering */
import { Effect, Metric, MetricBoundaries } from 'effect'
import { describe, expect, it } from 'vitest'
import { renderPrometheus } from './prometheus.js'

// Metrics live in a process-global registry, so each test uses a uniquely named
// instrument and asserts on its own lines rather than the whole document.
const scrape = () => Effect.runPromise(renderPrometheus)

describe('prometheus rendering', () => {
  it('renders a labelled counter with HELP and TYPE headers', async () => {
    const counter = Metric.counter('acp_test_counter_total', {
      description: 'a test counter',
    }).pipe(Metric.tagged('operation', 'ClaimWork'))
    await Effect.runPromise(Metric.update(counter, 2))
    await Effect.runPromise(Metric.update(counter, 3))

    const out = await scrape()

    expect(out).toContain('# HELP acp_test_counter_total a test counter')
    expect(out).toContain('# TYPE acp_test_counter_total counter')
    expect(out).toContain('acp_test_counter_total{operation="ClaimWork"} 5')
  })

  it('collapses multiple label sets under one header block', async () => {
    const base = Metric.counter('acp_test_multi_total')
    await Effect.runPromise(
      Metric.update(base.pipe(Metric.tagged('outcome', 'success')), 1),
    )
    await Effect.runPromise(
      Metric.update(base.pipe(Metric.tagged('outcome', 'failure')), 1),
    )

    const out = await scrape()
    const typeLines = out
      .split('\n')
      .filter((line) => line === '# TYPE acp_test_multi_total counter')

    expect(typeLines).toHaveLength(1)
    expect(out).toContain('acp_test_multi_total{outcome="success"} 1')
    expect(out).toContain('acp_test_multi_total{outcome="failure"} 1')
  })

  it('expands a histogram into cumulative bucket, sum, and count series', async () => {
    const hist = Metric.histogram(
      'acp_test_latency_seconds',
      MetricBoundaries.fromIterable([0.1, 0.5, 1]),
      'a test histogram',
    )
    await Effect.runPromise(Metric.update(hist, 0.2))

    const out = await scrape()

    expect(out).toContain('# TYPE acp_test_latency_seconds histogram')
    expect(out).toContain('acp_test_latency_seconds_bucket{le="0.1"} 0')
    expect(out).toContain('acp_test_latency_seconds_bucket{le="0.5"} 1')
    expect(out).toContain('acp_test_latency_seconds_bucket{le="1"} 1')
    expect(out).toContain('acp_test_latency_seconds_bucket{le="+Inf"} 1')
    expect(out).toContain('acp_test_latency_seconds_count 1')
    expect(out).toMatch(/acp_test_latency_seconds_sum 0\.2/)
  })

  it('escapes quotes and backslashes in label values', async () => {
    const counter = Metric.counter('acp_test_escape_total').pipe(
      Metric.tagged('route', 'GET /a"b\\c'),
    )
    await Effect.runPromise(Metric.update(counter, 1))

    const out = await scrape()

    expect(out).toContain('acp_test_escape_total{route="GET /a\\"b\\\\c"} 1')
  })
})
