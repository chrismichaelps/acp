/** @Acp.Infra.PlatformNode.HttpServer — Node HTTP socket Layer */
import { createServer } from 'node:http'
import { NodeHttpServer } from '@effect/platform-node'
import { Config, Effect, Layer } from 'effect'

export const nodeHttpServerLayer = (port: number) =>
  NodeHttpServer.layer(() => createServer(), { port })

export const NodeHttpServerLive = Layer.unwrapEffect(
  Effect.map(
    Config.integer('ACP_PORT').pipe(Config.withDefault(4317)),
    nodeHttpServerLayer,
  ),
)
