// @Acp.Scripts.Bump.ParseCommits — full conventional commit evidence parsing

const RECORD_SEPARATOR = '\u001e'
const FIELD_SEPARATOR = '\u001f'
const SUBJECT_PATTERN = /^([a-z][a-z0-9-]*)(?:\(([^)\r\n]+)\))?(!)?: (.+)$/
const BREAKING_TRAILER_PATTERN =
  /(?:^|\r?\n)(?:BREAKING CHANGE|BREAKING-CHANGE):(?:[ \t]|$)/

export function parseConventionalCommit({ subject, body }) {
  if (typeof subject !== 'string' || typeof body !== 'string') {
    throw new TypeError('commit subject and body must be strings')
  }

  const match = SUBJECT_PATTERN.exec(subject)
  return Object.freeze({
    subject,
    body,
    type: match?.[1] ?? 'unknown',
    scope: match?.[2] ?? null,
    summary: match?.[4] ?? subject,
    breaking: Boolean(match?.[3]) || BREAKING_TRAILER_PATTERN.test(body),
  })
}

export function parseCommitLog(output) {
  if (typeof output !== 'string') {
    throw new TypeError('git log output must be a string')
  }
  if (output.length === 0) return Object.freeze([])

  const records = output
    .split(RECORD_SEPARATOR)
    .filter((record) => record !== '')
  return Object.freeze(
    records.map((record) => {
      const separator = record.indexOf(FIELD_SEPARATOR)
      if (separator < 0) {
        throw new Error('malformed git log record: missing field separator')
      }
      return parseConventionalCommit({
        subject: record.slice(0, separator),
        body: record.slice(separator + FIELD_SEPARATOR.length),
      })
    }),
  )
}
