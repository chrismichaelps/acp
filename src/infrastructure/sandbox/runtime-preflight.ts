/** @Acp.Infra.Sandbox.RuntimePreflight — verify the hardened runtime exists */
import { Either, Option } from 'effect'

/**
 * Checks that a configured OCI runtime is one the daemon actually offers.
 *
 * Without this, an operator who sets `ACP_SANDBOX_RUNTIME=kata` on a daemon
 * that only has `runc` believes they have hardware isolation and does not:
 * the mistake surfaces later as a container-create failure, or — worse — is
 * read as a transient error and worked around. Isolation strength is the one
 * setting that must not silently be weaker than requested, so it is checked
 * once at startup and fails closed. See [[ADR-0026-agent-sandbox-runtime]].
 */
export const assertRuntimeAvailable = (
  configured: Option.Option<string>,
  available: readonly string[],
): Either.Either<void, string> =>
  Option.match(configured, {
    onNone: () => Either.right(undefined),
    onSome: (runtime) =>
      available.includes(runtime)
        ? Either.right(undefined)
        : Either.left(
            `ACP_SANDBOX_RUNTIME=${runtime} is not offered by the Docker daemon; available runtimes: ${
              available.length === 0 ? '(none reported)' : available.join(', ')
            }`,
          ),
  })
