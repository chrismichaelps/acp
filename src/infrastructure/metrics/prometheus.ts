/** @Acp.Infra.Metrics.Prometheus — render the metric registry as scrape text */
import { Effect, Metric, MetricState, Option } from 'effect'
import type { MetricPair } from 'effect'

// The Prometheus text exposition format, version 0.0.4. We render straight from
// Effect's metric registry snapshot rather than depend on a client library:
// counters and gauges become one line per label set, histograms expand into the
// cumulative `_bucket`/`_sum`/`_count` families Prometheus expects.

export const PROMETHEUS_CONTENT_TYPE =
  'text/plain; version=0.0.4; charset=utf-8'

const escapeLabelValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')

// Prometheus wants a bare decimal; `+Inf` for the catch-all bucket, and integers
// without a trailing `.0` so counters read cleanly.
const formatValue = (value: number): string => {
  if (value === Number.POSITIVE_INFINITY) return '+Inf'
  if (value === Number.NEGATIVE_INFINITY) return '-Inf'
  if (Number.isNaN(value)) return 'NaN'
  return String(value)
}

interface Label {
  readonly key: string
  readonly value: string
}

const renderLabels = (labels: readonly Label[]): string => {
  if (labels.length === 0) return ''
  const inner = labels
    .map((label) => `${label.key}="${escapeLabelValue(label.value)}"`)
    .join(',')
  return `{${inner}}`
}

const withExtraLabel = (
  labels: readonly Label[],
  key: string,
  value: string,
): readonly Label[] => [...labels, { key, value }]

const sampleLine = (
  name: string,
  labels: readonly Label[],
  value: number,
): string => `${name}${renderLabels(labels)} ${formatValue(value)}`

interface RenderedMetric {
  readonly type: 'counter' | 'gauge' | 'histogram'
  readonly help: string
  readonly lines: readonly string[]
}

const renderPair = (
  pair: MetricPair.MetricPair.Untyped,
): RenderedMetric | undefined => {
  const key = pair.metricKey
  const name = key.name
  const help = Option.getOrElse(key.description, () => '')
  const labels = key.tags.map((tag) => ({ key: tag.key, value: tag.value }))
  const state = pair.metricState

  if (MetricState.isCounterState(state)) {
    return {
      type: 'counter',
      help,
      lines: [sampleLine(name, labels, Number(state.count))],
    }
  }

  if (MetricState.isGaugeState(state)) {
    return {
      type: 'gauge',
      help,
      lines: [sampleLine(name, labels, Number(state.value))],
    }
  }

  if (MetricState.isHistogramState(state)) {
    const lines: string[] = []
    let sawInfinity = false
    for (const [boundary, count] of state.buckets) {
      const le =
        boundary === Number.POSITIVE_INFINITY ? '+Inf' : formatValue(boundary)
      if (le === '+Inf') sawInfinity = true
      lines.push(
        sampleLine(`${name}_bucket`, withExtraLabel(labels, 'le', le), count),
      )
    }
    // `fromIterable` always appends +Inf, but guard in case a boundary set didn't.
    if (!sawInfinity) {
      lines.push(
        sampleLine(
          `${name}_bucket`,
          withExtraLabel(labels, 'le', '+Inf'),
          state.count,
        ),
      )
    }
    lines.push(sampleLine(`${name}_sum`, labels, state.sum))
    lines.push(sampleLine(`${name}_count`, labels, state.count))
    return { type: 'histogram', help, lines }
  }

  // Frequencies and summaries are not part of the exposed contract.
  return undefined
}

/**
 * Format a metric-registry snapshot as Prometheus text. `HELP`/`TYPE` headers
 * are emitted once per metric name, ahead of every series that shares it.
 */
export const formatSnapshot = (
  pairs: readonly MetricPair.MetricPair.Untyped[],
): string => {
  const byName = new Map<string, { header: RenderedMetric; lines: string[] }>()
  const order: string[] = []

  for (const pair of pairs) {
    const rendered = renderPair(pair)
    if (rendered === undefined) continue
    const name = pair.metricKey.name
    const existing = byName.get(name)
    if (existing === undefined) {
      byName.set(name, { header: rendered, lines: [...rendered.lines] })
      order.push(name)
    } else {
      existing.lines.push(...rendered.lines)
    }
  }

  const blocks: string[] = []
  for (const name of order) {
    const entry = byName.get(name)
    if (entry === undefined) continue
    const header: string[] = []
    if (entry.header.help !== '') {
      header.push(
        `# HELP ${name} ${entry.header.help.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}`,
      )
    }
    header.push(`# TYPE ${name} ${entry.header.type}`)
    blocks.push([...header, ...entry.lines].join('\n'))
  }

  return blocks.length === 0 ? '' : `${blocks.join('\n')}\n`
}

/** Snapshot the metric registry and render it as Prometheus scrape text. */
export const renderPrometheus: Effect.Effect<string> = Effect.map(
  Metric.snapshot,
  formatSnapshot,
)
