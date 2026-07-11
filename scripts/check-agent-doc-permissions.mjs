#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL, URL } from 'node:url'

const permissionToken =
  /\b(?:worker|workspace|event|work|lease|artifact|checkpoint|memory|review):[a-z_]+\b/g

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

  return {
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
      `${String(result.tokens)} tokens, ${String(result.permissions)} protocol permissions`,
  )
}

const entryPath = process.argv[1]
if (
  entryPath !== undefined &&
  pathToFileURL(entryPath).href === import.meta.url
) {
  await main()
}
