/** @Acp.Infra.Hooks.WebhookTransport — HTTPS POST for remote hook verdicts */
import { Effect } from 'effect'
import type { HookPayload } from '../../domain/hooks/index.js'

/**
 * Posts a hook payload and returns the parsed JSON body.
 *
 * Deliberately thin: every verdict decision lives in `decodeWebhookResponse`,
 * which is pure and therefore testable without a server, so this only moves
 * bytes. No credentials are attached — an endpoint that needs to authenticate
 * the host should do so at the network layer rather than have ACP forward
 * secrets it holds for other purposes.
 */
export const webhookTransport =
  (url: string) =>
  (payload: HookPayload): Effect.Effect<unknown, Error> =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
        return (await response.json()) as unknown
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
    })
