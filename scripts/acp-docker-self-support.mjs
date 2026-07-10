import { spawn } from 'node:child_process'
import { clearTimeout, setTimeout } from 'node:timers'
import { setTimeout as delay } from 'node:timers/promises'

export const allPermissions = [
  'worker:read',
  'workspace:read',
  'workspace:write',
  'event:read',
  'work:create',
  'work:claim',
  'work:update',
  'work:publish_event',
  'lease:create',
  'lease:renew',
  'lease:release',
  'lease:revoke',
  'artifact:create',
  'artifact:update',
  'artifact:delete',
  'checkpoint:create',
  'memory:create',
  'memory:read',
  'review:create',
  'review:approve',
  'review:reject',
  'review:request_changes',
  'review:cancel',
]

export const assert = (condition, message) => {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

export const runProcess = (command, args, options = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      rejectPromise(
        new Error(
          `${command} timed out after ${String(options.timeoutMs ?? 180_000)} ms`,
        ),
      )
    }, options.timeoutMs ?? 180_000)
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error) => {
      clearTimeout(timeout)
      rejectPromise(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      resolvePromise({ ok: code === 0, code, stdout, stderr })
    })
    child.stdin.end(options.input ?? '')
  })

export const docker = (args, options) => runProcess('docker', args, options)

export const dockerOk = async (args, options) => {
  const result = await docker(args, options)
  assert(
    result.ok,
    `docker ${args.join(' ')} exited ${String(result.code)}: ${result.stderr || result.stdout}`,
  )
  return result.stdout.trim()
}

export const containerFetch = async (
  container,
  path,
  { method = 'GET', token = '', body } = {},
) => {
  const script = `
const [path, method, token, rawBody] = process.argv.slice(1)
const response = await fetch('http://127.0.0.1:4317' + path, {
  method,
  headers: {
    ...(token === '' ? {} : { authorization: 'Bearer ' + token }),
    ...(rawBody === '' ? {} : { 'content-type': 'application/json' }),
  },
  ...(rawBody === '' ? {} : { body: rawBody }),
})
const text = await response.text()
let parsed
try { parsed = JSON.parse(text) } catch { parsed = text }
console.log(JSON.stringify({ status: response.status, body: parsed }))
`
  const output = await dockerOk([
    'exec',
    container,
    'node',
    '--input-type=module',
    '-e',
    script,
    path,
    method,
    token,
    body === undefined ? '' : JSON.stringify(body),
  ])
  return JSON.parse(output)
}

const tryJson = (line) => {
  try {
    return JSON.parse(line.trim())
  } catch {
    return undefined
  }
}

const parsePayload = (stdout, stderr) => {
  const direct = tryJson(stdout)
  if (direct !== undefined) return direct
  const candidates = stderr
    .split('\n')
    .map(tryJson)
    .filter((value) => value !== undefined)
  return (
    candidates.find(
      (value) => value && typeof value === 'object' && 'error' in value,
    ) ?? candidates[0]
  )
}

export const makeCli = (container) => async (token, args) => {
  const result = await docker([
    'exec',
    '-e',
    'ACP_BASE_URL=http://127.0.0.1:4317',
    '-e',
    `ACP_RPC_TOKEN=${token}`,
    container,
    'node',
    'dist/app/cli/main.js',
    ...args,
  ])
  return { ...result, payload: parsePayload(result.stdout, result.stderr) }
}

export const expectOk = async (cli, label, token, args) => {
  const result = await cli(token, args)
  assert(
    result.ok,
    `${label} exited ${String(result.code)}: ${result.stderr || result.stdout}`,
  )
  assert(result.payload !== undefined, `${label} returned no JSON payload`)
  return result.payload
}

export const expectSuccess = async (cli, label, token, args) => {
  const result = await cli(token, args)
  assert(
    result.ok,
    `${label} exited ${String(result.code)}: ${result.stderr || result.stdout}`,
  )
  return result.payload
}

export const expectError = async (cli, label, token, args, code) => {
  const result = await cli(token, args)
  assert(!result.ok, `${label} unexpectedly succeeded`)
  assert(
    result.payload?.error?.code === code,
    `${label} expected ${code}, got ${JSON.stringify(result.payload)}`,
  )
  return result.payload
}

export const waitForReady = async (container) => {
  const deadline = Date.now() + 30_000
  for (;;) {
    const result = await docker([
      'exec',
      container,
      'node',
      '-e',
      "fetch('http://127.0.0.1:4317/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
    ])
    if (result.ok) return
    if (Date.now() >= deadline) {
      const logs = await docker(['logs', '--tail', '100', container])
      throw new Error(
        `container ${container} did not become ready: ${logs.stderr || logs.stdout}`,
      )
    }
    await delay(250)
  }
}

export const initAgent = async (
  cli,
  role,
  runId,
  permissions = allPermissions,
) => {
  const worker = `agent_self_${role}_${runId}`.replace(/[^a-zA-Z0-9_]/g, '_')
  const session = await expectOk(cli, `session init (${role})`, '', [
    'session',
    'init',
    '--worker',
    worker,
    '--name',
    `Docker self ${role}`,
    '--kind',
    'agent',
    '--vendor',
    'openai',
    '--capabilities',
    'can_edit_files,can_run_commands,can_create_prs,can_review,supports_checkpoints,supports_leases',
    '--permissions',
    permissions.join(','),
  ])
  return { worker, token: session.session_id, session }
}
