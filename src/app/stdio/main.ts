/** @Acp.App.Stdio.Main — JSON-RPC stdio bridge to the local ACP host */
import { NodeRuntime } from '@effect/platform-node'
import { Config, Console, Effect, Either } from 'effect'
import {
  nodeStdin,
  nodeStdoutWrite,
} from '../../infrastructure/platform-node/index.js'
import {
  appendFrameBytes,
  decodeStdioFrames,
  encodeStdioFrame,
} from './frames.js'

type Bytes = Uint8Array

const readChunk = (chunk: unknown): Bytes =>
  chunk instanceof Uint8Array ? chunk : new TextEncoder().encode(String(chunk))

const postRpc = async (
  baseUrl: string,
  payload: string,
  token: string,
): Promise<string | undefined> => {
  const response = await fetch(`${baseUrl}/rpc`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
    },
    body: payload,
  })
  return response.status === 204 ? undefined : await response.text()
}

const runLoop = (
  baseUrl: string,
  token: string,
): Effect.Effect<void, unknown> =>
  Effect.tryPromise(async () => {
    let buffer: Bytes = new Uint8Array()
    for await (const chunk of nodeStdin()) {
      buffer = appendFrameBytes(buffer, readChunk(chunk))
      const decoded = decodeStdioFrames(buffer)
      if (Either.isLeft(decoded)) {
        throw decoded.left
      }
      buffer = decoded.right.rest
      for (const message of decoded.right.messages) {
        const response = await postRpc(baseUrl, message, token)
        if (response !== undefined) {
          nodeStdoutWrite(encodeStdioFrame(response))
        }
      }
    }
  })

const program = Effect.gen(function* () {
  const configuredBaseUrl = yield* Config.string('ACP_BASE_URL').pipe(
    Config.withDefault(''),
  )
  const port = yield* Config.integer('ACP_PORT').pipe(Config.withDefault(4317))
  const token = yield* Config.string('ACP_RPC_TOKEN').pipe(
    Config.withDefault(''),
  )
  const baseUrl =
    configuredBaseUrl === ''
      ? `http://localhost:${String(port)}`
      : configuredBaseUrl

  yield* runLoop(baseUrl, token).pipe(
    Effect.tapError((error) => Console.error(String(error))),
  )
})

NodeRuntime.runMain(program)
