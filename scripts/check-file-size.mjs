#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const maxLines = 500
const extensions = new Set(['.ts', '.tsx'])
const ignoredSegments = new Set(['generated', 'node_modules', 'dist'])

const hasTrackedExtension = (path) =>
  [...extensions].some((extension) => path.endsWith(extension))

const walk = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return ignoredSegments.has(entry.name) ? [] : walk(path)
    }
    return entry.isFile() && hasTrackedExtension(path) ? [path] : []
  })
}

const countLines = (path) => {
  const text = readFileSync(path, 'utf8')
  if (text.length === 0) {
    return 0
  }
  return text.endsWith('\n')
    ? text.split('\n').length - 1
    : text.split('\n').length
}

const files = statSync(join(root, 'src')).isDirectory()
  ? walk(join(root, 'src'))
  : []

const oversized = files
  .map((file) => ({ file: relative(root, file), lines: countLines(file) }))
  .filter(({ lines }) => lines > maxLines)
  .sort((a, b) => b.lines - a.lines)

if (oversized.length > 0) {
  console.error(`Source files must stay at or below ${maxLines} lines.`)
  for (const { file, lines } of oversized) {
    console.error(`${file}: ${lines} lines`)
  }
  process.exitCode = 1
}
