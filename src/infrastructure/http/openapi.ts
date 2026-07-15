/** @Acp.Infra.Http.OpenApi — OpenAPI description generated from the typed REST contract */
import { OpenApi } from '@effect/platform'
import { ACP_PROTOCOL_VERSION } from '../../protocol/schema/index.js'
import { AcpHttpApi } from './acp-http-api.js'

const DESCRIPTION =
  'REST contract for the Agent Coordination Protocol (ACP) reference host. ' +
  'Generated from the typed route definitions; regenerate with `pnpm openapi:generate`.'

const SESSION_SECURITY_SCHEME = 'AcpSession'
const SESSION_INITIALIZE_OPERATION = 'session.initializeSession'
const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const satisfies readonly OpenApi.OpenAPISpecMethodName[]

const sessionSecurity = (): OpenApi.OpenAPISecurityRequirement => ({
  [SESSION_SECURITY_SCHEME]: [],
})

const securePathItem = (
  pathItem: OpenApi.OpenAPISpecPathItem,
): OpenApi.OpenAPISpecPathItem => {
  const secured: OpenApi.OpenAPISpecPathItem = { ...pathItem }

  for (const method of HTTP_METHODS) {
    const operation = pathItem[method]
    if (operation === undefined) continue

    secured[method] = {
      ...operation,
      security:
        operation.operationId === SESSION_INITIALIZE_OPERATION
          ? []
          : [sessionSecurity()],
    }
  }

  return secured
}

/**
 * Build the OpenAPI document for the ACP REST surface directly from the
 * `AcpHttpApi` contract. The router enforces bearer authorization outside that
 * declaration, so this projection restores the production security contract.
 */
export const buildAcpOpenApi = (): OpenApi.OpenAPISpec => {
  const spec = OpenApi.fromApi(AcpHttpApi)
  const paths: OpenApi.OpenAPISpecPaths = {}

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    paths[path] = securePathItem(pathItem)
  }

  return {
    ...spec,
    info: {
      ...spec.info,
      title: 'ACP',
      version: ACP_PROTOCOL_VERSION,
      description: DESCRIPTION,
    },
    paths,
    components: {
      ...spec.components,
      securitySchemes: {
        ...spec.components.securitySchemes,
        [SESSION_SECURITY_SCHEME]: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'ACP session id',
          description:
            'Session credential returned by POST /v1/session/initialize.',
        },
      },
    },
    security: [sessionSecurity()],
  }
}

/** Canonical on-disk form of the committed `openapi.json` artifact. */
export const serializeOpenApi = (doc: OpenApi.OpenAPISpec): string =>
  `${JSON.stringify(doc, null, 2)}\n`
