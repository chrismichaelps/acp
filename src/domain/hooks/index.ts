/** @Acp.Domain.Hooks — public surface */
export {
  allow,
  denyAbort,
  denyContinue,
  DEFAULT_HOOK_TIMEOUT_MS,
} from './hook.js'
export type { Hook, HookOutcome, HookPayload, HookPoint } from './hook.js'
export {
  HookDispatcher,
  HookDispatcherLive,
  NoHooksLive,
  makeHookDispatcher,
} from './hook-dispatcher.js'
export type { HookDispatcherApi } from './hook-dispatcher.js'
export {
  decodeWebhookResponse,
  loadWebhookHooks,
  makeWebhookHook,
} from './webhook-hook.js'
export type {
  WebhookHookDeclaration,
  WebhookHooksDocument,
} from './webhook-hook.js'
