// @Acp.Scripts.Bump.Args — strict command-line grammar for version bump operations

const LEVELS = new Set(['major', 'minor', 'patch', 'none'])
const VALUE_FLAGS = new Map([
  ['--release', 'release'],
  ['--protocol', 'protocol'],
  ['--since', 'since'],
])
const BOOLEAN_FLAGS = new Map([
  ['--baseline', 'baseline'],
  ['--force', 'force'],
  ['--yes', 'yes'],
  ['--dry-run', 'dryRun'],
])

export function parseArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError('argv must be an array')
  }

  const values = {
    release: null,
    protocol: null,
    since: null,
    baseline: false,
    force: false,
    yes: false,
    dryRun: false,
  }
  const seen = new Set()

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const valueKey = VALUE_FLAGS.get(flag)
    const booleanKey = BOOLEAN_FLAGS.get(flag)

    if (!valueKey && !booleanKey) {
      throw new Error(`unknown flag: ${String(flag)}`)
    }
    if (seen.has(flag)) {
      throw new Error(`repeated flag: ${flag}`)
    }
    seen.add(flag)

    if (booleanKey) {
      values[booleanKey] = true
      continue
    }

    const value = argv[index + 1]
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.startsWith('--')
    ) {
      throw new Error(`${flag} requires a value`)
    }
    values[valueKey] = value
    index += 1
  }

  for (const key of ['release', 'protocol']) {
    const level = values[key]
    if (level !== null && !LEVELS.has(level)) {
      throw new Error(`invalid ${key} level: ${level}`)
    }
  }
  if (values.since !== null && values.since.startsWith('-')) {
    throw new Error(`invalid since ref: ${values.since}`)
  }

  if (values.baseline) {
    const incompatible =
      values.release !== null ||
      values.protocol !== null ||
      values.since !== null ||
      values.force
    if (incompatible) {
      throw new Error(
        'baseline mode cannot be combined with release, protocol, since, or force',
      )
    }
  }

  if (values.yes && values.dryRun) {
    throw new Error('--yes and --dry-run cannot be combined')
  }

  return Object.freeze({
    mode: values.baseline ? 'baseline' : 'bump',
    release: values.release,
    protocol: values.protocol,
    since: values.since,
    force: values.force,
    yes: values.yes,
    dryRun: values.dryRun,
  })
}
