import { assert, expectError, expectOk } from './acp-docker-self-support.mjs'

export const runArtifactScenario = async (
  cli,
  { owner, reader, workspace, work },
) => {
  const artifact = await expectOk(cli, 'artifact create', owner.token, [
    'artifact',
    'create',
    '--workspace',
    workspace.id,
    '--work',
    work.id,
    '--kind',
    'markdown',
    '--summary',
    'Docker self report',
    '--content',
    'initial report',
  ])
  const updatedArtifact = await expectOk(cli, 'artifact update', owner.token, [
    'artifact',
    'update',
    artifact.id,
    '--kind',
    'json',
    '--media-type',
    'application/json',
    '--summary',
    'Updated Docker self report',
    '--content',
    '{"ok":true}',
  ])
  assert(updatedArtifact.kind === 'json', 'artifact update missed kind')
  const content = await expectOk(cli, 'artifact content', reader.token, [
    'artifact',
    'content',
    artifact.id,
  ])
  assert(content.content === '{"ok":true}', 'artifact content mismatch')
  const prArtifact = await expectOk(cli, 'artifact pr', owner.token, [
    'artifact',
    'pr',
    '--workspace',
    workspace.id,
    '--work',
    work.id,
    '--url',
    'https://github.com/chrismichaelps/acp/pull/258',
    '--summary',
    'Known merged ACP pull request',
  ])
  const workArtifacts = await expectOk(
    cli,
    'artifact list work',
    reader.token,
    ['artifact', 'list', '--work', work.id, '--kind', 'json'],
  )
  const workspaceArtifacts = await expectOk(
    cli,
    'artifact list workspace',
    reader.token,
    ['artifact', 'list', '--workspace', workspace.id],
  )
  assert(
    workArtifacts.length === 1 &&
      workArtifacts[0].id === artifact.id &&
      workspaceArtifacts.some((item) => item.id === prArtifact.id),
    'artifact list surfaces disagreed',
  )
  const disposable = await expectOk(
    cli,
    'artifact create disposable',
    owner.token,
    [
      'artifact',
      'create',
      '--workspace',
      workspace.id,
      '--work',
      work.id,
      '--kind',
      'log',
      '--content',
      'delete me',
    ],
  )
  await expectOk(cli, 'artifact delete', owner.token, [
    'artifact',
    'delete',
    disposable.id,
  ])
  await expectError(
    cli,
    'artifact repeated delete',
    owner.token,
    ['artifact', 'delete', disposable.id],
    'not_found',
  )

  return { artifact, prArtifact }
}
