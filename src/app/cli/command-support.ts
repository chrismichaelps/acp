/** @Acp.App.Cli.CommandSupport — shared parser primitives */
import { Data, Either } from 'effect'

export interface CliRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  readonly path: string
  readonly body?: Record<string, unknown>
  readonly stream?: boolean
  readonly label: string
}

export class CliError extends Data.TaggedError('CliError')<{
  readonly message: string
}> {}

export interface Parsed {
  readonly positionals: readonly string[]
  readonly flags: Readonly<Record<string, string>>
}

export type CommandHandler = (
  parsed: Parsed,
) => Either.Either<CliRequest, CliError>

export const flag = (
  flags: Readonly<Record<string, string>>,
  key: string,
): Either.Either<string, CliError> =>
  key in flags && flags[key] !== 'true'
    ? Either.right(flags[key])
    : Either.left(new CliError({ message: `missing required --${key}` }))

export const positional = (
  positionals: readonly string[],
  index: number,
  name: string,
): Either.Either<string, CliError> =>
  index < positionals.length
    ? Either.right(positionals[index])
    : Either.left(new CliError({ message: `missing <${name}>` }))

export const optional = (
  flags: Readonly<Record<string, string>>,
  key: string,
): Record<string, string> =>
  key in flags && flags[key] !== 'true' ? { [key]: flags[key] } : {}

export const optionalAs = (
  flags: Readonly<Record<string, string>>,
  key: string,
  field: string,
): Record<string, string> =>
  key in flags && flags[key] !== 'true' ? { [field]: flags[key] } : {}

export const optionalQuery = (
  flags: Readonly<Record<string, string>>,
  key: string,
  field: string = key,
): readonly string[] =>
  key in flags && flags[key] !== 'true'
    ? [`${field}=${encodeURIComponent(flags[key])}`]
    : []

export const csvFlag = (
  flags: Readonly<Record<string, string>>,
  key: string,
): Either.Either<readonly string[], CliError> =>
  Either.map(flag(flags, key), (value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  )

export const encodePathSegment = (value: string): string =>
  encodeURIComponent(value)

export const scopedWorkListPath = (
  flags: Readonly<Record<string, string>>,
  collection: string,
): Either.Either<string, CliError> =>
  Either.gen(function* () {
    if ('workspace' in flags) {
      const workspaceId = yield* flag(flags, 'workspace')
      return `/v1/workspaces/${encodePathSegment(workspaceId)}/${collection}`
    }
    const workId = yield* flag(flags, 'work')
    return `/v1/work/${encodePathSegment(workId)}/${collection}`
  })

export const integerFlag = (
  flags: Readonly<Record<string, string>>,
  key: string,
  min: number,
): Either.Either<number, CliError> => {
  const raw = flags[key]
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= min
    ? Either.right(parsed)
    : Either.left(new CliError({ message: `invalid --${key}: ${raw}` }))
}

export const positiveIntegerFlag = (
  flags: Readonly<Record<string, string>>,
  key: string,
) => integerFlag(flags, key, 1)
