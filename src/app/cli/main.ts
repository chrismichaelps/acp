/** @Acp.App.Cli.Main — acp command-line entrypoint */
import { HttpClient, HttpClientRequest } from '@effect/platform'
import { NodeHttpClient, NodeRuntime } from '@effect/platform-node'
import { Config, Console, Effect, Either, Stream } from 'effect'
import { nodeArgv } from '../../infrastructure/platform-node/index.js'
import { runCliRequest, withBearerToken } from './client.js'
import { CliError, parseArgs } from './commands.js'
import { usage } from './usage.js'

const program = Effect.gen(function* () {
  const parsed = parseArgs(nodeArgv())
  if (Either.isLeft(parsed)) {
    yield* Console.error(parsed.left.message)
    yield* Console.error(usage)
    return yield* Effect.fail(parsed.left)
  }
  const request = parsed.right

  const configuredBaseUrl = yield* Config.string('ACP_BASE_URL').pipe(
    Config.withDefault(''),
  )
  const port = yield* Config.integer('ACP_PORT').pipe(Config.withDefault(4317))
  const baseUrl =
    configuredBaseUrl === ''
      ? `http://localhost:${String(port)}`
      : configuredBaseUrl
  const token = yield* Config.string('ACP_RPC_TOKEN').pipe(
    Config.withDefault(''),
  )

  if (request.stream === true) {
    const client = yield* HttpClient.HttpClient
    const response = yield* client.execute(
      withBearerToken(
        HttpClientRequest.get(`${baseUrl}${request.path}`),
        token,
      ),
    )
    return yield* Stream.runForEach(
      Stream.decodeText(response.stream),
      (chunk) => Console.log(chunk),
    )
  }

  const result = yield* runCliRequest(request, baseUrl, token)
  if (result.status >= 400) {
    yield* Console.error(result.body)
    return yield* Effect.fail(
      new CliError({ message: `request failed (${String(result.status)})` }),
    )
  }
  return yield* Console.log(result.body)
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeHttpClient.layer)))
