/** @Acp.Infra.Http.OpenApi — OpenAPI description generated from the typed REST contract */
import { OpenApi } from '@effect/platform'
import { ACP_PROTOCOL_VERSION } from '../../protocol/schema/index.js'
import { AcpHttpApi } from './acp-http-api.js'

export interface OpenApiInfo {
  readonly title: string
  readonly version: string
  readonly description: string
  readonly [key: string]: unknown
}

export interface OpenApiDocument {
  readonly openapi: string
  readonly info: OpenApiInfo
  readonly paths: Record<string, unknown>
  readonly [key: string]: unknown
}

const DESCRIPTION =
  'REST contract for the Agent Coordination Protocol (ACP) reference host. ' +
  'Generated from the typed route definitions; regenerate with `pnpm openapi:generate`.'

/**
 * Build the OpenAPI document for the ACP REST surface directly from the
 * `AcpHttpApi` contract, then pin the identity fields so the artifact does not
 * drift with `@effect/platform` defaults. `info.version` tracks the protocol
 * version — the wire contract an OpenAPI consumer actually depends on.
 */
export const buildAcpOpenApi = (): OpenApiDocument => {
  const spec = OpenApi.fromApi(AcpHttpApi) as unknown as OpenApiDocument
  return {
    ...spec,
    info: {
      ...spec.info,
      title: 'ACP',
      version: ACP_PROTOCOL_VERSION,
      description: DESCRIPTION,
    },
  }
}

/** Canonical on-disk form of the committed `openapi.json` artifact. */
export const serializeOpenApi = (doc: OpenApiDocument): string =>
  `${JSON.stringify(doc, null, 2)}\n`
