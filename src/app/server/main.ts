/** @Acp.App.Server.Main — Node HTTP server entrypoint */
import { createServer } from 'node:http'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Config, Effect, Layer } from 'effect'
import { HttpAppLive } from './http-app.js'

const ServerLive = Layer.unwrapEffect(
  Effect.map(
    Config.integer('ACP_PORT').pipe(Config.withDefault(4317)),
    (port) => NodeHttpServer.layer(() => createServer(), { port }),
  ),
)

NodeRuntime.runMain(Layer.launch(HttpAppLive.pipe(Layer.provide(ServerLive))))
