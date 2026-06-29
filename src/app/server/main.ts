/** @Acp.App.Server.Main — Node HTTP server entrypoint */
import { NodeRuntime } from '@effect/platform-node'
import { Layer } from 'effect'
import { NodeHttpServerLive } from '../../infrastructure/platform-node/index.js'
import { withAcpJsonLogging } from '../logging.js'
import { HttpAppLive } from './http-app.js'

NodeRuntime.runMain(
  Layer.launch(HttpAppLive.pipe(Layer.provide(NodeHttpServerLive))).pipe(
    withAcpJsonLogging('server'),
  ),
)
