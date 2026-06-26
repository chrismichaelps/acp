/** @Acp.App.Server.Main — Node HTTP server entrypoint */
import { createServer } from 'node:http'
import { HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Config, Effect, Layer } from 'effect'
import { AppLive } from '../index.js'
import { IdClockLive } from './identity.js'
import { acpRouter } from './router.js'

const ServerLive = Layer.unwrapEffect(
  Effect.map(
    Config.integer('ACP_PORT').pipe(Config.withDefault(4317)),
    (port) => NodeHttpServer.layer(() => createServer(), { port }),
  ),
)

const HttpLive = HttpServer.serve(acpRouter).pipe(
  Layer.provide(Layer.mergeAll(AppLive, IdClockLive)),
  Layer.provide(ServerLive),
)

NodeRuntime.runMain(Layer.launch(HttpLive))
