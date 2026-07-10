import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const dist = fileURLToPath(new URL('../dist', import.meta.url))

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? collectFiles(path) : [path]
      }),
    )
  ).flat()
}

const files = (await collectFiles(dist)).map((path) =>
  relative(dist, path).replaceAll('\\', '/'),
)
const forbidden = files.filter(
  (entry) =>
    /\.(?:fixture|spec|test)\.js(?:\.map)?$/.test(entry) ||
    /(?:^|\/)[^/]*(?:dogfood|test)-support\.js(?:\.map)?$/.test(entry) ||
    /(?:^|\/)(?:__tests__|fixtures)(?:\/|$)/.test(entry),
)

if (forbidden.length > 0) {
  throw new Error(
    `production dist contains test artifacts:\n${forbidden.join('\n')}`,
  )
}

console.log(`Production dist contains ${String(files.length)} runtime files.`)
