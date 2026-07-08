/** @Acp.Infra.GitHub.Error — gh subprocess failure */
import { Data } from 'effect'

export class GitHubError extends Data.TaggedError('GitHubError')<{
  readonly command: string
  readonly stderr: string
}> {}
