// scripts/acp-docker-edge-smoke.mjs
// Proves the edge profile fronts both ACP deployment profiles and discovers
// every healthy HA replica without changing the direct 4317 entry point.
import { execFileSync, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const HOST = 'acp.localhost'
const sqliteCompose = ['compose', '--profile', 'sqlite', '--profile', 'edge']
const haCompose = ['compose', '--profile', 'ha', '--profile', 'edge']

function dc(compose, args, opts = {}) {
  return execFileSync('docker', [...compose, ...args], {
    stdio: 'inherit',
    ...opts,
  })
}

function dcCapture(compose, args) {
  return execFileSync('docker', [...compose, ...args], {
    encoding: 'utf8',
  }).trim()
}

function curl(args) {
  return spawnSync('curl', ['-sS', '--max-time', '5', ...args], {
    encoding: 'utf8',
  })
}

function curlStatus(url, extraArgs = []) {
  const res = spawnSync(
    'curl',
    [
      '-s',
      '-o',
      '/dev/null',
      '-w',
      '%{http_code}',
      '--max-time',
      '5',
      ...extraArgs,
      url,
    ],
    { encoding: 'utf8' },
  )
  return res.stdout.trim()
}

function curlHeaders(url, extraArgs = []) {
  return curl(['-D', '-', '-o', '/dev/null', ...extraArgs, url]).stdout
}

function curlJson(url) {
  const result = curl(['--fail', url])
  if (result.status !== 0) return undefined
  try {
    return JSON.parse(result.stdout)
  } catch {
    return undefined
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

function headerValue(headers, name) {
  const prefix = `${name.toLowerCase()}:`
  const line = headers
    .split(/\r?\n/)
    .find((candidate) => candidate.toLowerCase().startsWith(prefix))
  return line?.slice(prefix.length).trim()
}

function backendCount(service) {
  const servers = service?.loadBalancer?.servers
  return Array.isArray(servers) ? servers.length : 0
}

async function waitForReady(label) {
  for (let i = 0; i < 60; i++) {
    const code = curlStatus('http://127.0.0.1/ready', ['-H', `Host: ${HOST}`])
    if (code === '200') return
    await delay(2000)
  }
  throw new Error(
    `${label} timed out waiting for /ready through Traefik on :80`,
  )
}

async function waitForBackends(expected, label) {
  let service
  for (let i = 0; i < 60; i++) {
    service = curlJson('http://127.0.0.1:8080/api/http/services/acp@docker')
    if (backendCount(service) === expected) return service
    await delay(2000)
  }
  throw new Error(
    `${label} expected ${String(expected)} Traefik backends, got ${String(
      backendCount(service),
    )}: ${JSON.stringify(service)}`,
  )
}

async function verifyEdge(compose, label, expectedBackends, upArgs = []) {
  try {
    dc(compose, ['up', '-d', '--build', ...upArgs])
    await waitForReady(label)

    const http = curlStatus('http://127.0.0.1/ready', ['-H', `Host: ${HOST}`])
    assert(http === '200', `${label} HTTP :80 returned ${http}`)

    const https = curlStatus('https://127.0.0.1/ready', [
      '-k',
      '-H',
      `Host: ${HOST}`,
    ])
    assert(https === '200', `${label} HTTPS :443 returned ${https}`)

    const unknownHost = curlStatus('http://127.0.0.1/ready', [
      '-H',
      'Host: unknown.localhost',
    ])
    assert(
      unknownHost === '404',
      `${label} unknown host returned ${unknownHost}`,
    )

    const headers = curlHeaders('https://127.0.0.1/ready', [
      '-k',
      '-H',
      `Host: ${HOST}`,
    ])
    assert(
      headerValue(headers, 'x-content-type-options') === 'nosniff',
      `${label} missing X-Content-Type-Options`,
    )
    assert(
      headerValue(headers, 'x-frame-options') === 'DENY',
      `${label} missing X-Frame-Options`,
    )
    assert(
      headerValue(headers, 'strict-transport-security')?.includes(
        'max-age=31536000',
      ),
      `${label} missing Strict-Transport-Security`,
    )

    const service = await waitForBackends(expectedBackends, label)
    assert(
      service.status === 'enabled',
      `${label} Traefik service is not enabled`,
    )

    if (label === 'ha') {
      const replicas = dcCapture(compose, ['ps', '-q', 'acp-ha'])
        .split('\n')
        .filter(Boolean)
      assert(
        replicas.length === 2,
        `ha expected 2 replicas, got ${replicas.length}`,
      )
    }

    console.log(
      `${label} edge OK: HTTP/HTTPS routing, headers, dashboard API, and ${String(
        expectedBackends,
      )} backend(s)`,
    )
  } finally {
    spawnSync('docker', [...compose, 'down', '-v'], { stdio: 'inherit' })
  }
}

async function main() {
  await verifyEdge(sqliteCompose, 'sqlite', 1)
  await verifyEdge(haCompose, 'ha', 2, ['--scale', 'acp-ha=2'])
  console.log('edge smoke OK: sqlite and two-replica HA profiles passed')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
