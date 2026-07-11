import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const [compose, dependabot] = await Promise.all([
  readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/dependabot.yml', import.meta.url), 'utf8'),
])

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

assert.match(
  dependabot,
  /^\s*- package-ecosystem: docker-compose$/m,
  'Dependabot must retain Docker Compose update discovery',
)
const automatedDependencies = [
  ...dependabot.matchAll(/^\s+- dependency-name:\s*(\S+)\s*$/gm),
].map((match) => match[1])
assert.deepEqual(
  automatedDependencies,
  ['traefik'],
  'Dependabot must automate only Traefik; socket-proxy Git tags can precede GHCR images',
)

console.log(
  'edge runtime policy OK: exact image pins with Traefik-only automation',
)
