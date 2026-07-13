#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL, URL } from 'node:url'

const permissionToken =
  /\b(?:worker|workspace|event|work|lease|artifact|checkpoint|memory|review):[a-z_]+\b/g

export const workerLoopPermissions = [
  'workspace:read',
  'event:read',
  'work:create',
  'work:claim',
  'work:update',
  'lease:create',
  'lease:release',
  'artifact:create',
  'checkpoint:create',
  'memory:create',
  'review:create',
].sort()

export const reviewerMinimumV01Permissions = [
  'workspace:read',
  'workspace:write',
  'event:read',
  'memory:create',
  'memory:read',
  'review:approve',
  'review:reject',
  'review:request_changes',
  'review:cancel',
].sort()

export const extractPermissionVocabulary = (schemaSource) => {
  const declaration = schemaSource.match(
    /export const Permission = Schema\.Literal\(([\s\S]*?)\n\)/,
  )
  assert.ok(declaration, 'Permission Schema.Literal declaration not found')

  const permissions = [...declaration[1].matchAll(/'([a-z-]+:[a-z_]+)'/g)].map(
    (match) => match[1],
  )
  assert.ok(permissions.length > 0, 'Permission vocabulary is empty')
  return new Set(permissions)
}

export const documentedPermissionTokens = (document) =>
  [...new Set(document.match(permissionToken) ?? [])].sort()

const normalizedShell = (document) =>
  document.replace(/\\\r?\n[ \t]*/g, '').replace(/\r\n/g, '\n')

const validateRoleBootstrap = (
  name,
  document,
  workerId,
  expectedPermissions,
  role,
  permissionDescription,
) => {
  const command = normalizedShell(document).match(
    new RegExp(`^acp session init --worker ${workerId}\\b[^\\n]*$`, 'm'),
  )?.[0]
  assert.ok(command, `${name} is missing the canonical ${role} session command`)

  const workspace = command.match(/--workspace\s+([^\s]+)/)?.[1]
  assert.ok(workspace, `${name} ${role} session command is missing --workspace`)

  const permissionList = command.match(/--permissions\s+([^\s]+)/)?.[1]
  assert.ok(
    permissionList,
    `${name} ${role} session command is missing --permissions`,
  )
  const permissions = [...new Set(permissionList.split(','))].sort()
  assert.deepEqual(
    permissions,
    expectedPermissions,
    `${name} session command must grant ${permissionDescription}`,
  )

  return { permissions, workspace }
}

export const validateWorkerBootstrap = (name, document) =>
  validateRoleBootstrap(
    name,
    document,
    'agent_codex',
    workerLoopPermissions,
    'worker',
    'the exact worker-loop permissions',
  )

export const validateReviewerBootstrap = (name, document) =>
  validateRoleBootstrap(
    name,
    document,
    'agent_reviewer',
    reviewerMinimumV01Permissions,
    'reviewer',
    'the minimum reviewer permission union expressible in v0.1',
  )

export const validateAgentDocuments = (schemaSource, documents) => {
  const vocabulary = extractPermissionVocabulary(schemaSource)
  let tokenCount = 0

  for (const [name, document] of documents) {
    const tokens = documentedPermissionTokens(document)
    tokenCount += tokens.length
    const invalid = tokens.filter((token) => !vocabulary.has(token))
    assert.deepEqual(
      invalid,
      [],
      `${name} contains permission tokens outside the protocol vocabulary`,
    )
  }

  const bootstrapDocuments = documents.filter(([name]) =>
    ['ACP-SKILL.md', 'wiki/references/agent-integration.md'].includes(name),
  )
  for (const [name, document] of bootstrapDocuments) {
    validateWorkerBootstrap(name, document)
    validateReviewerBootstrap(name, document)
  }

  return {
    bootstraps: bootstrapDocuments.length * 2,
    documents: documents.length,
    permissions: vocabulary.size,
    tokens: tokenCount,
  }
}

export const main = async () => {
  const schemaSource = await readFile(
    new URL('../src/protocol/schema/common.ts', import.meta.url),
    'utf8',
  )
  const documentPaths = [
    ['ACP-SKILL.md', '../ACP-SKILL.md'],
    ['README.md', '../README.md'],
    [
      'wiki/references/agent-integration.md',
      '../wiki/references/agent-integration.md',
    ],
  ]
  const documents = await Promise.all(
    documentPaths.map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), 'utf8'),
    ]),
  )
  const result = validateAgentDocuments(schemaSource, documents)
  console.log(
    `agent permission docs OK: ${String(result.documents)} documents, ` +
      `${String(result.bootstraps)} complete bootstraps, ${String(result.tokens)} tokens, ` +
      `${String(result.permissions)} protocol permissions`,
  )
}

const entryPath = process.argv[1]
if (
  entryPath !== undefined &&
  pathToFileURL(entryPath).href === import.meta.url
) {
  await main()
}
