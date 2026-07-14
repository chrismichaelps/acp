// @Acp.Scripts.AcpBump — fail-closed repository version bump orchestration

import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from './bump/args.mjs'
import {
  collectSignals,
  createGitRunner,
  resolveBaseline,
} from './bump/collect.mjs'
import { planBump } from './bump/policy.mjs'
import {
  changelogEntry,
  prependChangelogEntry,
  readPackageVersion,
  readProtocolVersion,
  rewritePackageVersion,
  rewriteProtocolVersion,
} from './bump/rewrite.mjs'
import { applyTransaction } from './bump/transaction.mjs'

const FILES = Object.freeze({
  package: 'package.json',
  protocol: 'src/protocol/version.ts',
  changelog: 'wiki/CHANGELOG.md',
})

function readSources(cwd) {
  return Object.fromEntries(
    Object.entries(FILES).map(([key, path]) => [
      key,
      readFileSync(join(cwd, path), 'utf8'),
    ]),
  )
}

function isDirty(git) {
  return (
    git(['status', '--porcelain=v1', '--untracked-files=normal']).trim() !== ''
  )
}

function currentHead(git) {
  return git(['rev-parse', 'HEAD']).trim()
}

function assertPostConfirmationState(git, expectedHead, operation) {
  if (isDirty(git)) {
    throw new Error(
      `working tree changed during confirmation; ${operation} refused`,
    )
  }
  if (currentHead(git) !== expectedHead) {
    throw new Error(`HEAD changed during confirmation; ${operation} refused`)
  }
}

function validateImplicitBaseline(baseline, release) {
  if (
    baseline.source === 'tag' &&
    /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/.test(
      baseline.ref,
    ) &&
    baseline.ref.slice(1) !== release
  ) {
    throw new Error(
      `package version ${release} does not match implicit baseline ${baseline.ref}; recover the missing release tag or use --since <ref>`,
    )
  }
}

function writeLine(output, line = '') {
  output.write(`${line}\n`)
}

function renderDiff(output, label, before, after) {
  const oldLines = before.split('\n')
  const newLines = after.split('\n')
  let prefix = 0
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix += 1
  }
  let oldSuffix = oldLines.length
  let newSuffix = newLines.length
  while (
    oldSuffix > prefix &&
    newSuffix > prefix &&
    oldLines[oldSuffix - 1] === newLines[newSuffix - 1]
  ) {
    oldSuffix -= 1
    newSuffix -= 1
  }

  writeLine(output, `--- ${label}`)
  writeLine(output, `+++ ${label}`)
  writeLine(output, '@@ proposed @@')
  for (const line of oldLines.slice(Math.max(0, prefix - 2), prefix)) {
    writeLine(output, ` ${line}`)
  }
  for (const line of oldLines.slice(prefix, oldSuffix)) {
    writeLine(output, `-${line}`)
  }
  for (const line of newLines.slice(prefix, newSuffix)) {
    writeLine(output, `+${line}`)
  }
  for (const line of newLines.slice(newSuffix, newSuffix + 2)) {
    writeLine(output, ` ${line}`)
  }
}

function prepareChanges({ cwd, sources, plan, date }) {
  const changes = []
  if (plan.release.current !== plan.release.next) {
    changes.push({
      path: join(cwd, FILES.package),
      label: FILES.package,
      before: sources.package,
      expected: sources.package,
      content: rewritePackageVersion(
        sources.package,
        plan.release.current,
        plan.release.next,
      ),
    })
  }
  if (plan.protocol.current !== plan.protocol.next) {
    changes.push({
      path: join(cwd, FILES.protocol),
      label: FILES.protocol,
      before: sources.protocol,
      expected: sources.protocol,
      content: rewriteProtocolVersion(
        sources.protocol,
        plan.protocol.current,
        plan.protocol.next,
      ),
    })
  }
  if (changes.length > 0) {
    changes.push({
      path: join(cwd, FILES.changelog),
      label: FILES.changelog,
      before: sources.changelog,
      expected: sources.changelog,
      content: prependChangelogEntry(
        sources.changelog,
        changelogEntry({
          date,
          release: plan.release,
          protocol: plan.protocol,
        }),
      ),
    })
  }
  return changes
}

async function confirmApply({ yes, input, output }) {
  if (yes) return true
  if (!input.isTTY || !output.isTTY) {
    throw new Error('non-interactive apply requires --yes')
  }

  const prompt = createInterface({ input, output, terminal: true })
  try {
    const answer = await prompt.question('Apply this version change? [y/N] ')
    return /^(?:y|yes)$/i.test(answer.trim())
  } catch {
    return false
  } finally {
    prompt.close()
  }
}

async function runBaseline({ args, git, input, output, sources, confirm }) {
  const release = readPackageVersion(sources.package)
  const tag = `v${release}`
  const head = currentHead(git)
  const collision = git(
    ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`],
    { allowFailure: true },
  )
  if (collision !== null) throw new Error(`baseline tag ${tag} already exists`)

  const dirty = isDirty(git)
  writeLine(output, `ACP baseline ${tag}`)
  writeLine(output, `target: ${head}`)
  writeLine(output, `working tree: ${dirty ? 'dirty' : 'clean'}`)
  if (args.dryRun) return
  if (dirty) throw new Error('working tree is dirty; baseline creation refused')
  if (!(await confirm({ yes: args.yes, input, output }))) {
    writeLine(output, 'Cancelled; no tag created.')
    return
  }

  assertPostConfirmationState(git, head, 'baseline creation')
  git(['tag', '-a', tag, '-m', `ACP release ${release}`, head])
  writeLine(output, `Created annotated baseline ${tag}.`)
}

async function runBump({
  args,
  cwd,
  git,
  input,
  output,
  sources,
  now,
  confirm,
}) {
  const head = currentHead(git)
  const release = readPackageVersion(sources.package)
  const protocol = readProtocolVersion(sources.protocol)
  const baseline = resolveBaseline({ since: args.since, git })
  validateImplicitBaseline(baseline, release)
  const signals = collectSignals({ baseline, git })
  const plan = planBump({
    signals,
    current: {
      release,
      protocol,
    },
    overrides: { release: args.release, protocol: args.protocol },
    force: args.force,
  })
  const dirty = isDirty(git)

  writeLine(output, 'ACP version bump plan')
  writeLine(output, `baseline: ${baseline.ref} (${baseline.commit})`)
  writeLine(
    output,
    `release: ${plan.release.current} → ${plan.release.next} (${plan.release.level})`,
  )
  writeLine(
    output,
    `protocol: ${plan.protocol.current} → ${plan.protocol.next} (${plan.protocol.level})`,
  )
  writeLine(output, `working tree: ${dirty ? 'dirty' : 'clean'}`)
  for (const reason of [...plan.release.reasons, ...plan.protocol.reasons]) {
    writeLine(output, `reason: ${reason}`)
  }
  for (const warning of plan.warnings) writeLine(output, `warning: ${warning}`)
  if (plan.violations.length > 0) {
    throw new Error(plan.violations.join('; '))
  }

  const changes = prepareChanges({
    cwd,
    sources,
    plan,
    date: now().toISOString().slice(0, 10),
  })
  if (changes.length === 0) {
    writeLine(output, 'No version changes required.')
    return
  }
  for (const change of changes) {
    renderDiff(output, change.label, change.before, change.content)
  }
  if (args.dryRun) return
  if (dirty) throw new Error('working tree is dirty; apply refused')
  if (!(await confirm({ yes: args.yes, input, output }))) {
    writeLine(output, 'Cancelled; no files changed.')
    return
  }

  assertPostConfirmationState(git, head, 'apply')
  applyTransaction(changes)
  writeLine(
    output,
    `Applied ${changes.length} file update(s). Review and commit them.`,
  )
  if (plan.release.current !== plan.release.next) {
    const tag = `v${plan.release.next}`
    writeLine(
      output,
      `After committing: git tag -a ${tag} -m "ACP release ${plan.release.next}"`,
    )
  }
}

export async function runVersionBump(
  argv,
  {
    cwd = process.cwd(),
    input = process.stdin,
    output = process.stdout,
    now = () => new Date(),
    confirm = confirmApply,
  } = {},
) {
  const args = parseArgs(argv)
  const git = createGitRunner({ cwd })
  const sources = readSources(cwd)
  if (args.mode === 'baseline') {
    return runBaseline({ args, git, input, output, sources, confirm })
  }
  return runBump({ args, cwd, git, input, output, sources, now, confirm })
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isEntrypoint) {
  runVersionBump(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`acp bump: ${error.message}\n`)
    process.exitCode = 1
  })
}
