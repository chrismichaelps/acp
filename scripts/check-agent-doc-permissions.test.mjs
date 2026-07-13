import { describe, expect, it } from 'vitest'
import {
  documentedPermissionTokens,
  extractPermissionVocabulary,
  main,
  reviewerMinimumV01Permissions,
  validateAgentDocuments,
  validateReviewerBootstrap,
  validateWorkerBootstrap,
  workerLoopPermissions,
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
    ).toEqual({
      bootstraps: 0,
      documents: 1,
      permissions: 2,
      tokens: 2,
    })
  })

  it('rejects an unknown permission with the document name', () => {
    expect(() =>
      validateAgentDocuments(schema, [
        ['skill.md', 'Do not drift to review:request.'],
      ]),
    ).toThrow(/skill\.md contains permission tokens.*review:request/s)
  })

  it('requires workspace binding and the exact worker lifecycle scopes', () => {
    const permissions = workerLoopPermissions.join(',')
    expect(
      validateWorkerBootstrap(
        'skill.md',
        `acp session init --worker agent_codex --name Codex \\
  --permissions ${permissions} \\
  --workspace workspace_primary`,
      ),
    ).toEqual({
      permissions: workerLoopPermissions,
      workspace: 'workspace_primary',
    })

    expect(() =>
      validateWorkerBootstrap(
        'skill.md',
        `acp session init --worker agent_codex --name Codex --permissions ${permissions}`,
      ),
    ).toThrow(/missing --workspace/)
    expect(() =>
      validateWorkerBootstrap(
        'skill.md',
        'acp session init --worker agent_codex --name Codex --permissions workspace:read --workspace workspace_primary',
      ),
    ).toThrow(/exact worker-loop permissions/)
  })

  it('pins the minimum reviewer permission union expressible in v0.1', () => {
    const permissions = reviewerMinimumV01Permissions.join(',')
    expect(
      validateReviewerBootstrap(
        'skill.md',
        `acp session init --worker agent_reviewer --name Reviewer \\
  --permissions ${permissions} \\
  --workspace workspace_primary`,
      ),
    ).toEqual({
      permissions: reviewerMinimumV01Permissions,
      workspace: 'workspace_primary',
    })

    expect(() =>
      validateReviewerBootstrap(
        'skill.md',
        `acp session init --worker agent_reviewer --name Reviewer --permissions ${permissions}`,
      ),
    ).toThrow(/reviewer session command is missing --workspace/)
    expect(() =>
      validateReviewerBootstrap(
        'skill.md',
        'acp session init --worker agent_reviewer --name Reviewer --permissions review:approve,review:reject,review:request_changes,review:cancel --workspace workspace_primary',
      ),
    ).toThrow(/minimum reviewer permission union expressible in v0\.1/)
  })
})
