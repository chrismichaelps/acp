import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const compose = await readFile(
  new URL('../docker-compose.yml', import.meta.url),
  'utf8',
)

const imageFor = (service) => {
  const match = compose.match(
    new RegExp(`^  ${service}:\\n(?: {4}.*\\n)*? {4}image: ([^\\s]+)$`, 'm'),
  )

  assert.ok(match, `docker-compose.yml must define an image for ${service}`)
  return match[1]
}

const exactReleaseImages = new Map([
  [
    'docker-socket-proxy',
    /^ghcr\.io\/tecnativa\/docker-socket-proxy:\d+\.\d+\.\d+$/,
  ],
  ['traefik', /^traefik:v\d+\.\d+\.\d+$/],
])

for (const [service, releasePattern] of exactReleaseImages) {
  const image = imageFor(service)
  assert.match(
    image,
    releasePattern,
    `${service} must use an exact release tag; found ${image}`,
  )
}

console.log(
  'edge runtime pins OK: Traefik and the Docker socket proxy use exact release tags',
)
