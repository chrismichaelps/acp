import { describe, expect, it } from 'vitest'
import {
  documentedPermissionTokens,
  extractPermissionVocabulary,
  main,
  validateAgentDocuments,
} from './check-agent-doc-permissions.mjs'

const schema = `export const Permission = Schema.Literal(
  'workspace:read',
  'review:create',
)
`

describe('agent permission documentation guard', () => {
  it('accepts the checked-in agent documents', async () => {
    await expect(main()).resolves.toBeUndefined()
  })

  it('derives and validates permission tokens from the schema source', () => {
    expect([...extractPermissionVocabulary(schema)]).toEqual([
      'workspace:read',
      'review:create',
    ])
    expect(
      documentedPermissionTokens(
        'Use workspace:read before requesting review:create.',
      ),
    ).toEqual(['review:create', 'workspace:read'])
    expect(
      validateAgentDocuments(schema, [
        ['skill.md', 'Use workspace:read and review:create.'],
      ]),
    ).toEqual({ documents: 1, permissions: 2, tokens: 2 })
  })

  it('rejects an unknown permission with the document name', () => {
    expect(() =>
      validateAgentDocuments(schema, [
        ['skill.md', 'Do not drift to review:request.'],
      ]),
    ).toThrow(/skill\.md contains permission tokens.*review:request/s)
  })
})
