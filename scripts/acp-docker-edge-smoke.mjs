// scripts/acp-docker-edge-smoke.mjs
// Proves the `edge` profile fronts the ACP host with Traefik: /ready answers 200
// through the proxy on :80 (Host header) and :443 (self-signed TLS). Mirrors the
// existing acp-docker-*-dogfood.mjs pattern (Node ESM + child_process).
import { execFileSync, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const HOST = 'acp.localhost'
const compose = ['compose', '--profile', 'sqlite', '--profile', 'edge']

function dc(args, opts = {}) {
  return execFileSync('docker', [...compose, ...args], {
    stdio: 'inherit',
    ...opts,
  })
}

function curlStatus(url, extraArgs) {
  // -s silent, -o /dev/null, -w write status, --max-time bounded, -k allow self-signed.
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

async function waitForReady() {
  for (let i = 0; i < 60; i++) {
    const code = curlStatus('http://127.0.0.1/ready', ['-H', `Host: ${HOST}`])
    if (code === '200') return
    await delay(2000)
  }
  throw new Error('timed out waiting for /ready through Traefik on :80')
}

async function main() {
  try {
    dc(['up', '-d', '--build'])
    await waitForReady()

    const http = curlStatus('http://127.0.0.1/ready', ['-H', `Host: ${HOST}`])
    if (http !== '200')
      throw new Error(`HTTP :80 route returned ${http}, expected 200`)

    const https = curlStatus('https://127.0.0.1/ready', [
      '-k',
      '-H',
      `Host: ${HOST}`,
    ])
    if (https !== '200')
      throw new Error(`HTTPS :443 route returned ${https}, expected 200`)

    console.log('edge smoke OK: /ready is 200 through Traefik on :80 and :443')
  } finally {
    spawnSync('docker', [...compose, 'down', '-v'], { stdio: 'inherit' })
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
