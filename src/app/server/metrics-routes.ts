/** @Acp.App.Server.MetricsRoutes — token-gated Prometheus scrape endpoint */
import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import { Effect, Option } from 'effect'
import { AppConfigTag } from '../../config/app-config.js'
import {
  PROMETHEUS_CONTENT_TYPE,
  recordBuildInfo,
  renderPrometheus,
} from '../../infrastructure/metrics/index.js'
import { respond } from './route-support.js'

// Prometheus scrapes with a static bearer credential, not a session token, so
// this route sits outside the session-scope model of the v1 API. `ACP_METRICS_TOKEN`
// both switches the endpoint on and secures it: unset means the endpoint does
// not exist (404), so metrics are never exposed by accident.

const bearerToken = Effect.map(HttpServerRequest.HttpServerRequest, (req) =>
  Option.match(Headers.get(req.headers, 'authorization'), {
    onNone: () => '',
    onSome: (header) =>
      header.toLowerCase().startsWith('bearer ')
        ? header.slice('bearer '.length).trim()
        : '',
  }),
)

const notFound = HttpServerResponse.unsafeJson(
  { error: { code: 'not_found', message: 'Metrics endpoint is disabled.' } },
  { status: 404 },
)

const unauthorized = HttpServerResponse.unsafeJson(
  { error: { code: 'unauthorized', message: 'Invalid metrics token.' } },
  { status: 401, headers: { 'www-authenticate': 'Bearer' } },
)

export const metricsRoute = respond('GET /metrics')(
  Effect.gen(function* () {
    const config = yield* AppConfigTag
    if (Option.isNone(config.metricsToken)) {
      return notFound
    }

    const token = yield* bearerToken
    if (token !== config.metricsToken.value) {
      return unauthorized
    }

    yield* recordBuildInfo
    const body = yield* renderPrometheus
    return HttpServerResponse.text(body, {
      status: 200,
      contentType: PROMETHEUS_CONTENT_TYPE,
    })
  }),
)
