// @Acp.Scripts.Bump.Transaction — rollback-capable atomic multi-file replacement

import {
  chmodSync,
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join } from 'node:path'

export const defaultFileOperations = Object.freeze({
  chmodSync,
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
})

export class TransactionError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'TransactionError'
  }
}

export class TransactionRollbackError extends TransactionError {
  constructor(message, { cause, rollbackErrors }) {
    super(message, { cause })
    this.name = 'TransactionRollbackError'
    this.rollbackErrors = Object.freeze(rollbackErrors)
  }
}

function assertChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new TypeError('transaction requires at least one change')
  }
  const paths = new Set()
  for (const change of changes) {
    if (
      !change ||
      typeof change.path !== 'string' ||
      (typeof change.content !== 'string' && !Buffer.isBuffer(change.content))
    ) {
      throw new TypeError('transaction changes require path and content')
    }
    if (paths.has(change.path)) {
      throw new Error(`duplicate transaction target: ${change.path}`)
    }
    paths.add(change.path)
  }
}

function safeUnlink(path, operations) {
  try {
    operations.unlinkSync(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function writeTemporary({ path, content, mode }, operations, temporaryPaths) {
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.acp-bump-${process.pid}-${randomUUID()}.tmp`,
  )
  temporaryPaths.add(temporaryPath)
  let descriptor
  try {
    descriptor = operations.openSync(temporaryPath, 'wx', mode)
    operations.writeFileSync(descriptor, content)
    operations.fsyncSync(descriptor)
  } finally {
    if (descriptor !== undefined) operations.closeSync(descriptor)
  }
  operations.chmodSync(temporaryPath, mode)
  return temporaryPath
}

export function applyTransaction(
  changes,
  { operations = defaultFileOperations } = {},
) {
  assertChanges(changes)
  const originals = changes.map((change) => ({
    ...change,
    original: operations.readFileSync(change.path),
    mode: operations.statSync(change.path).mode & 0o777,
  }))
  const temporaryPaths = new Set()
  const prepared = []
  const replaced = []

  try {
    for (const change of originals) {
      prepared.push({
        ...change,
        temporaryPath: writeTemporary(change, operations, temporaryPaths),
      })
    }

    for (const change of prepared) {
      operations.renameSync(change.temporaryPath, change.path)
      temporaryPaths.delete(change.temporaryPath)
      replaced.push(change)
    }
  } catch (cause) {
    const rollbackErrors = []
    for (const change of replaced.reverse()) {
      try {
        const rollbackPath = writeTemporary(
          { path: change.path, content: change.original, mode: change.mode },
          operations,
          temporaryPaths,
        )
        operations.renameSync(rollbackPath, change.path)
        temporaryPaths.delete(rollbackPath)
      } catch (error) {
        rollbackErrors.push(error)
      }
    }
    for (const temporaryPath of temporaryPaths) {
      try {
        safeUnlink(temporaryPath, operations)
      } catch (error) {
        rollbackErrors.push(error)
      }
    }

    if (rollbackErrors.length > 0) {
      throw new TransactionRollbackError(
        'version bump transaction failed and rollback was incomplete',
        { cause, rollbackErrors },
      )
    }
    throw new TransactionError(
      'version bump transaction failed; changes rolled back',
      {
        cause,
      },
    )
  }

  return Object.freeze(replaced.map((change) => change.path))
}
