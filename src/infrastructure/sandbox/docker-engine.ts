/** @Acp.Infra.Sandbox.DockerEngine — HTTP over the Docker unix socket */
import { request } from 'node:http'
import { Effect } from 'effect'
import type { DockerEngineApi } from './docker-sandbox-provider.js'

const DEFAULT_SOCKET = '/var/run/docker.sock'
const API_VERSION = 'v1.44'

interface Response {
  readonly status: number
  readonly body: string
}

const call = (
  socketPath: string,
  method: string,
  path: string,
  body?: unknown,
): Effect.Effect<Response, Error> =>
  Effect.async<Response, Error>((resume) => {
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const req = request(
      {
        socketPath,
        method,
        path: `/${API_VERSION}${path}`,
        headers:
          payload === undefined
            ? {}
            : {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => (text += chunk))
        res.on('end', () => {
          resume(Effect.succeed({ status: res.statusCode ?? 0, body: text }))
        })
      },
    )
    req.on('error', (cause) => {
      resume(Effect.fail(cause))
    })
    if (payload !== undefined) req.write(payload)
    req.end()
  })

const expectOk = (op: string) => (res: Response) =>
  res.status >= 200 && res.status < 300
    ? Effect.succeed(res)
    : Effect.fail(
        new Error(`${op} failed: HTTP ${String(res.status)} ${res.body}`),
      )

/**
 * The real engine. Deliberately thin: every security decision lives in
 * `toCreateContainerRequest`, which is pure and therefore testable without a
 * daemon, so this layer only moves bytes.
 */
export const dockerEngineOverSocket = (
  socketPath: string = DEFAULT_SOCKET,
): DockerEngineApi => ({
  createContainer: (name, body) =>
    call(socketPath, 'POST', `/containers/create?name=${name}`, body).pipe(
      Effect.flatMap(expectOk('create container')),
      Effect.map((res) => (JSON.parse(res.body) as { Id: string }).Id),
    ),
  startContainer: (id) =>
    call(socketPath, 'POST', `/containers/${id}/start`).pipe(
      Effect.flatMap(expectOk('start container')),
      Effect.asVoid,
    ),
  inspectContainer: (name) =>
    Effect.gen(function* () {
      const res = yield* call(socketPath, 'GET', `/containers/${name}/json`)
      // 404 is "no sandbox", a normal answer rather than a failure.
      if (res.status === 404) return undefined
      const ok = yield* expectOk('inspect container')(res)
      return JSON.parse(ok.body) as {
        Id: string
        State: { Status: string; ExitCode: number }
      }
    }),
  removeContainer: (name) =>
    call(socketPath, 'DELETE', `/containers/${name}?force=true`).pipe(
      Effect.flatMap((res) =>
        res.status === 404
          ? Effect.succeed(res)
          : expectOk('remove container')(res),
      ),
      Effect.asVoid,
    ),
})
