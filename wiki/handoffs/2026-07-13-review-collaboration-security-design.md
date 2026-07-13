---
date: 2026-07-13
topic: review-collaboration-security-design
from_role: DNA Engineer
to_role: Shadow
status: COMPLETE
maturity: STABLE
tags: [handoff, auth, review, security, dogfood]
---

# Handoff — Review Collaboration Security Design

## Done

- Revised [[ADR-0013-review-collaboration-permission]] through four independent
  ACP review rounds and a forced grill.
- Split action authority: `review:collaborate` covers four comment mutations and
  grill open/ask/verdict/evaluate; `review:respond` covers only grill answer.
- Added a real per-session invariant: [[session.schema]] rejects initialization
  containing both scopes before minting a credential, through every transport.
- Narrowed the security claim. Open v0.1 `session.initialize` trusts the local
  issuer and does not prevent a malicious client from minting multiple worker ids
  or tokens. [[ADR-0015-trusted-session-issuance]] records the separate hosted
  issuer risk and executable acceptance evidence; it is not implemented here.
- Defined scope-first opaque-target authorization. Missing scope is 403 for any
  id; correctly scoped missing and foreign targets share the exact 404
  `NotFoundError` envelope; in-scope identity mismatch is the existing 400
  `ValidationError` envelope with deterministic field issues.
- Applied the FMCF Split Protocol: implemented the focused
  [[review-collaboration-auth]] and [[review-collaboration-auth.test]] source
  units instead of adding four helpers to the existing 149-line
  [[resource-workspace-auth]] module. The generic module keeps its existing
  behavior and remains below the 15% change threshold.
- Made add-comment/open-grill path review → work → workspace authoritative;
  body review/work/workspace mismatch is never trusted or rewritten.
- Projected the exact worker/reviewer bootstrap into [[agent-integration]] and
  `@root/ACP-SKILL.md`, including fail-closed session rotation and the trusted-
  issuer limitation.
- Kept comment/grill commands REST-owned. Native RPC and JSON-RPC HTTP/WebSocket
  propagate either permission and reject the pair; no dead command was added.
- Added the independent [[acp-rpc-handlers]] success-projection obligation:
  native `session.initialize` must return `permissions: payload.permissions`.
- Specified an exact [[stdio-main]] Docker proof: spawn the production bridge,
  exchange UTF-8 byte-counted Content-Length frames, assert the returned
  permission/binding/session id, reject a dual-scope frame, then use the valid
  session on REST.
- Kept host provisioning/workspace lifecycle authority separate in
  [[ADR-0014-workspace-administration-authority]].

## Bounded security decision (do not overclaim)

- A single session may carry `review:respond` or `review:collaborate`, never both.
- Canonical role tokens exercise the intended answer/adjudication separation.
- Do not add a same-worker-id cross-session ban in this slice. Worker ids are
  caller-selected at open bootstrap, so a malicious client can choose another id
  and bypass the rule.
- Do not describe the canonical tokens or per-session refinement as independent
  identity enforcement. That requires verified external identity and server-side
  role assignment from ADR-0015.

## Stable implementation contract

- `workspace:write` aliases neither review permission and loses all nine review-
  gate mutations after upgrade until sessions are reinitialized.
- [[review-collaboration-auth]] checks action scope before lookup, derives the
  workspace from persisted state, and converts only foreign binding denial into
  `NotFoundError(entity, requestedId)`.
- Add/open mismatch issues are exactly `review_id must match the target review`,
  `work_id must match the target review work`, then
  `workspace_id must match the target review workspace`.
- Dual-scope initialization issue is exactly
  `review:respond and review:collaborate are mutually exclusive`.
- The existing global protocol-error mapper remains unchanged.
- No native RPC/JSON-RPC comment or grill command is introduced.

## Implemented source and verification surface

Production source:

- `@root/src/protocol/schema/common.ts` — add both permission literals.
- `@root/src/protocol/schema/session.schema.ts` — export and use the shared
  mutually exclusive session-permission array schema.
- `@root/src/infrastructure/http/acp-http-api.ts` — use that array in request and
  response handshakes; echo exact permissions.
- `@root/src/app/server/router.ts` — preserve exact REST success projection.
- `@root/src/infrastructure/rpc/acp-rpc-handlers.ts` — preserve exact native RPC
  success projection with `permissions: payload.permissions`.
- `@root/src/app/server/review-collaboration-auth.ts` — new focused four-helper
  scope-first/non-enumerating boundary.
- `@root/src/app/server/review-comment-routes.ts` and
  `@root/src/app/server/grill-routes.ts` — migrate nine mutation scopes and call
  the focused helper module.
- Canonical bootstrap/guard and Docker dogfood support files already named by
  the route/schema/transport mirrors and `@root/ACP-SKILL.md`.

Focused tests:

- `@root/src/protocol/schema/schema.test.ts`
- `@root/src/infrastructure/http/acp-http-api.test.ts`
- `@root/src/app/server/router.test.ts`
- `@root/src/infrastructure/rpc/acp-rpc-handlers.test.ts`
- `@root/src/app/server/native-rpc-route.test.ts`
- `@root/src/app/server/rpc-endpoint.test.ts`
- `@root/src/app/server/rpc-socket.test.ts`
- `@root/src/app/server/review-collaboration-auth.test.ts` (new)
- `@root/src/app/server/review-comment-routes.test.ts`
- `@root/src/app/server/grill-routes.test.ts`
- the production Docker auth/stdio dogfood probe documented by [[stdio-main]].

ADR-0014 and ADR-0015 remain explicitly deferred.

## ACP review evidence

- Round 1 review: `review_mrjl6j5os`
- Round 1 findings memory: `memory_mrjlddt910`
- Grill: `grill_mrjlbn0aw`; all questions answered
- Round 2 review: `review_mrjlvs111d` (`changes_requested`)
- Round 2 findings memory: `memory_mrjm1beu1h`
- Round 2 comments: `reviewcomment_mrjm19ug1e`,
  `reviewcomment_mrjm1ad41f`, `reviewcomment_mrjm1aue1g`
- Reviewer owns all comment resolution; the worker must not resolve them.
- Round 3 checkpoint: `checkpoint_mrjmkqcv1r`
- Round 3 handoff memory: `memory_mrjmkqvu1s`
- Round 3 live worktree artifact: `artifact_mrjmkrdn1t`
- Round 3 independent review: `review_mrjmlj3y1u` (`changes_requested`).
- Round 3 comment: `reviewcomment_mrjmqyyr1v` identified an unrefined
  `InitializeSessionResponse.permissions` signature; the API mirror now uses
  `SessionPermissions` on both request and response and names the response-side
  decode rejection explicitly. Reviewer owns comment resolution.
- Round 4 checkpoint: `checkpoint_mrjmtcg31x`
- Round 4 handoff memory: `memory_mrjmtczb1y`
- Round 4 live worktree artifact: `artifact_mrjmtdkp1z`
- Round 4 independent review: `review_mrjmtqfa20` (`approved`).
- Final review memory: `memory_mrjmxrrn21`; all seven review comments are
  resolved and `grill_mrjlbn0aw` is `passed`.

## Implementation reconciliation

- The focused authorization module and tests are active, not planned.
- REST add/open handlers derive review ownership before validating body identity;
  opaque comment, grill, and question mutations enforce scope before lookup and
  return non-enumerating 404s for foreign bindings.
- Session codecs and all session transports preserve each role independently and
  reject their union before issuing a session.
- Canonical CLI, GitHub bridge, and resume fixtures now use persisted review
  targets and the correct collaboration/response roles.
- Docker self-dogfood exercises a real workspace-bound stdio reviewer token,
  respondent and collaborator denial matrices, legacy `workspace:write` denial,
  workspace-administration denial, deterministic identity mismatch, and foreign
  versus missing opaque targets.

## Exact next action

Run the repository-focused suites, complete static/full validation, and execute
the production Docker ACP self-dogfood gate. Publish the documentation and code
as issue-linked commits only if every gate and the final independent ACP review
pass. Do not implement [[ADR-0014-workspace-administration-authority]] or
[[ADR-0015-trusted-session-issuance]] in this slice.

## Links

[[ADR-0013-review-collaboration-permission]] ·
[[ADR-0014-workspace-administration-authority]] ·
[[ADR-0015-trusted-session-issuance]] · [[agent-integration]] · [[common]] ·
[[session.schema]] · [[acp-http-api]] · [[acp-rpc-handlers]] ·
[[review-comment-routes]] · [[grill-routes]] ·
[[review-collaboration-auth]] · [[resource-workspace-auth]] · [[stdio-main]] ·
[[grammar/typescript]]
