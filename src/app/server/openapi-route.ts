/** @Acp.App.Server.OpenApiRoute — unauthenticated GET /openapi.json serving the REST contract */
import { HttpServerResponse } from '@effect/platform'
import { Effect } from 'effect'
import { buildAcpOpenApi } from '../../infrastructure/http/openapi.js'
import { respond } from './route-support.js'

// The document is a pure projection of the static route contract, so it is
// computed once at load time — there is nothing per request to recompute. Served
// unauthenticated like /health so external tooling can fetch the contract before
// a session exists.
const acpOpenApiDocument = buildAcpOpenApi()

export const openApiDocumentRoute = respond('GET /openapi.json')(
  Effect.succeed(
    HttpServerResponse.unsafeJson(acpOpenApiDocument, { status: 200 }),
  ),
)
