import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import {
  assert,
  containerFetch,
  dockerOk,
  expectOk,
  runProcess,
} from './acp-docker-self-support.mjs'

const waitForText = async (read, expected, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (read().includes(expected)) return
    await delay(100)
  }
  throw new Error(`timed out waiting for ${expected}`)
}

const proveSseCli = async ({ container, scenario, cli, runId }) => {
  const args = [
    'exec',
    '-e',
    'ACP_BASE_URL=http://127.0.0.1:4317',
    '-e',
    `ACP_RPC_TOKEN=${scenario.owner.token}`,
    container,
    'node',
    'dist/app/cli/main.js',
    'events',
    'stream',
    '--workspace',
    scenario.workspace.id,
  ]
  const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => (output += chunk))
  child.stderr.on('data', (chunk) => (output += chunk))
  await delay(500)
  await expectOk(cli, 'workspace update for SSE', scenario.owner.token, [
    'workspace',
    'update',
    scenario.workspace.id,
    '--name',
    `Docker SSE ${runId}`,
    '--kind',
    'container',
    '--uri',
    `docker://acp-self/${runId}`,
    '--default-branch',
    'main',
  ])
  await waitForText(() => output, 'workspace.updated')
  return child
}

const proveJsonRpcHttp = async ({ container, scenario }) => {
  const result = await containerFetch(container, '/rpc', {
    method: 'POST',
    token: scenario.owner.token,
    body: {
      jsonrpc: '2.0',
      id: 'docker-http',
      method: 'work.get',
      params: { work_id: scenario.work.id },
    },
  })
  assert(result.status === 200, `JSON-RPC HTTP returned ${result.status}`)
  assert(
    result.body.result.id === scenario.work.id,
    'JSON-RPC HTTP work mismatch',
  )
}

const proveStdio = async ({ container, scenario }) => {
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 'docker-stdio',
    method: 'work.get',
    params: { work_id: scenario.work.id },
  })
  const frame = `Content-Length: ${String(Buffer.byteLength(request))}\r\n\r\n${request}`
  const result = await runProcess(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      'ACP_BASE_URL=http://127.0.0.1:4317',
      '-e',
      `ACP_RPC_TOKEN=${scenario.owner.token}`,
      container,
      'node',
      'dist/app/stdio/main.js',
    ],
    { input: frame },
  )
  assert(result.ok, `stdio bridge failed: ${result.stderr}`)
  const separator = result.stdout.indexOf('\r\n\r\n')
  assert(separator >= 0, `stdio response had no frame: ${result.stdout}`)
  const payload = JSON.parse(result.stdout.slice(separator + 4))
  assert(payload.result.id === scenario.work.id, 'stdio work mismatch')
}

const proveWebSocket = async ({ container, scenario }) => {
  const script = `
const [token, workspaceId, workId] = process.argv.slice(1)
const socket = new WebSocket('ws://127.0.0.1:4317/rpc?token=' + token)
const timeout = setTimeout(() => { console.error('websocket timeout'); process.exit(1) }, 10000)
socket.addEventListener('open', () => socket.send(JSON.stringify({
  jsonrpc: '2.0', id: 'subscribe', method: 'events.subscribe',
  params: { workspace_id: workspaceId }
})))
socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data))
  if (payload.id === 'subscribe') socket.send(JSON.stringify({
    jsonrpc: '2.0', id: 'publish', method: 'work.publish_event',
    params: { work_id: workId, type: 'work.progressed', data: { source: 'docker-websocket' } }
  }))
  if (payload.method === 'events.event' && payload.params?.type === 'work.progressed') {
    clearTimeout(timeout); console.log(JSON.stringify(payload)); socket.close()
  }
})
socket.addEventListener('error', () => { console.error('websocket error'); process.exit(1) })
`
  const output = await dockerOk([
    'exec',
    container,
    'node',
    '-e',
    script,
    scenario.owner.token,
    scenario.workspace.id,
    scenario.work.id,
  ])
  const payload = JSON.parse(output)
  assert(
    payload.params.work_id === scenario.work.id,
    'WebSocket event mismatch',
  )
}

const proveNativeRpc = async ({ container, scenario }) => {
  const script = `
import { Effect } from 'effect'
import {
  acpRpcClientHostLayer, makeAcpRpcClient, withAcpRpcBearer
} from './dist/infrastructure/rpc/index.js'
const [token, workId] = process.argv.slice(1)
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* makeAcpRpcClient
    return yield* withAcpRpcBearer(token)(client.work.get({ work_id: workId }))
  }).pipe(
    Effect.provide(acpRpcClientHostLayer('http://127.0.0.1:4317')),
    Effect.scoped,
  ),
)
console.log(JSON.stringify(result))
`
  const output = await dockerOk([
    'exec',
    container,
    'node',
    '--input-type=module',
    '-e',
    script,
    scenario.owner.token,
    scenario.work.id,
  ])
  assert(JSON.parse(output).id === scenario.work.id, 'native RPC work mismatch')
}

export const proveTransports = async (context) => {
  await proveJsonRpcHttp(context)
  await proveStdio(context)
  await proveWebSocket(context)
  await proveNativeRpc(context)
  return proveSseCli(context)
}
