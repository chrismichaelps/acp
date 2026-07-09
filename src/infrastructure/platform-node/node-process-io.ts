/** @Acp.Infra.PlatformNode.ProcessIO — Node process IO adapter */
import { execFile } from 'node:child_process'
import process from 'node:process'
import { Effect } from 'effect'

export const nodeArgv = (): readonly string[] => process.argv.slice(2)

export const nodeStdin = (): AsyncIterable<unknown> => process.stdin

export const nodeStdoutWrite = (chunk: string | Uint8Array): void => {
  process.stdout.write(chunk)
}

export interface ProcessResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

export const runProcess = (
  command: string,
  args: readonly string[],
  options: { readonly input?: string } = {},
): Effect.Effect<ProcessResult> =>
  Effect.async<ProcessResult>((resume) => {
    const child = execFile(
      command,
      [...args],
      { shell: false, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code
            : error
              ? -1
              : 0
        resume(
          Effect.succeed({
            code,
            stdout,
            stderr: stderr || (error && code === -1 ? error.message : ''),
          }),
        )
      },
    )
    if (options.input !== undefined && child.stdin !== null) {
      child.stdin.end(options.input)
    }
  })
