/** @Acp.Infra.PlatformNode.ProcessIO — Node process IO adapter */
import process from 'node:process'

export const nodeArgv = (): readonly string[] => process.argv.slice(2)

export const nodeStdin = (): AsyncIterable<unknown> => process.stdin

export const nodeStdoutWrite = (chunk: string | Uint8Array): void => {
  process.stdout.write(chunk)
}
