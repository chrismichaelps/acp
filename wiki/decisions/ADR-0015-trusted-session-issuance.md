---
type: decision
status: PROPOSED
date: 2026-07-13
tags: [adr, proposed, backlog, auth, identity, hosting, security]
aliases: [ADR-0015, trusted-session-issuance]
---

# ADR-0015 — Trusted Session Issuance for Hosted ACP

## Status

PROPOSED / BACKLOG. This decision records a production-hosting prerequisite and
acceptance evidence; it is not implemented by the ADR-0013 review-collaboration
slice. Local and self-dogfood bootstraps continue to operate under a trusted
operator/client assumption.

## Context

ACP v0.1 leaves `session.initialize` open because it is the route that mints the
first bearer credential. Its payload is caller-controlled: the client selects a
worker id, permission array, and optional workspace bindings. Requiring bearer
auth on every later route therefore proves possession of a minted session, but
does not prove that a trusted authority approved the requested identity or
permissions.

This is an exact hosted-mode risk. A malicious client that can reach the open
bootstrap can mint arbitrary allowed scopes and identities, create separate
`review:respond` and `review:collaborate` sessions, or select another worker id
to bypass any cross-session rule keyed only by caller-provided identity.
Workspace binding limits where a session can act; caller-selected binding and
scope do not establish who was entitled to act there.

[[ADR-0013-review-collaboration-permission]] adds a real but deliberately narrow
invariant: one session initialization request containing both response and
collaboration scopes is rejected before a token is minted. That prevents an
accidental or overbroad single token. It does not prevent a malicious bootstrap
client from minting multiple identities or tokens, and ACP must not advertise it
as worker/reviewer independence against a hostile issuer.

## Proposed Decision

Introduce a trusted session-issuance boundary for shared/hosted deployments.
Authentication at that boundary establishes an external principal; server-side
policy derives the ACP worker identity, permission set, and workspace bindings.
The client may request a role or workspace, but cannot grant itself scopes,
bindings, or an arbitrary worker identity.

The design must keep local bootstrap usable. A configuration-selected issuer can
retain the open trusted-client bootstrap for local/self-dogfood profiles while a
hosted issuer requires an operator bootstrap secret, OIDC/service identity, or
another authenticated provisioning flow. Exact credential technology remains a
future design choice; the policy boundary is the invariant.

Cross-session separation, if required by deployment policy, must be based on the
verified external principal and review/work role assignment—not a caller-supplied
ACP worker id. ADR-0013 therefore does not add a same-worker-id domain ban.

## Hosted-Mode Acceptance Evidence

Implementation is complete only when executable evidence proves:

1. An unauthenticated client cannot mint a hosted session or choose arbitrary
   permissions, workspace bindings, or worker identity.
2. An authenticated principal receives only server-policy-derived scopes and
   bindings; adding `workspace:write`, `review:respond`, or
   `review:collaborate` to the request cannot self-escalate authority.
3. Stable external identity maps deterministically to ACP worker attribution,
   with documented collision, rename, and deprovisioning behavior.
4. A deployment policy can deny dual respondent/collaborator assignment for the
   same verified principal and review/work context across multiple sessions.
5. Issued sessions can be revoked and their issuer, principal, policy decision,
   worker, scopes, and bindings are auditable without logging bearer secrets.
6. REST, native Effect RPC, JSON-RPC HTTP/WebSocket, and stdio share the same
   issuance/denial policy; no transport retains an open escalation path.
7. Docker hostile-client tests attempt arbitrary identities, scope escalation,
   foreign workspace binding, multiple-token role splitting, revoked-session
   reuse, and transport bypasses, and observe deterministic denial.
8. Deployment docs and profile defaults fail closed: `hosted` cannot start in an
   externally reachable configuration with only caller-authorized bootstrap.

## Consequences

- Until this ADR lands, `hosted` is a runtime topology preset, not a claim that
  ACP ships a complete public identity/credential plane.
- ADR-0013 can safely reduce accidental token overgrant and separate action
  scopes without claiming malicious-client identity separation.
- Local/self-dogfood operators remain responsible for controlling access to the
  open bootstrap endpoint.

## Alternatives

**Ban two roles by ACP worker id in the session registry** — rejected for this
slice. The bootstrap client chooses that id and can select another one, so the
rule is bypassable without verified identity.

**Close `session.initialize` behind an ACP bearer token** — rejected as a full
solution. It creates a bootstrap cycle unless a separate trusted credential or
issuer exists.

**Treat workspace binding as identity proof** — rejected. It constrains tenant
location but says nothing about entitlement when the caller selected the
binding.

## Referenced by

[[ADR-0008-deployment-storage-topology]] ·
[[ADR-0013-review-collaboration-permission]] · [[deployment]] · [[acp-router]] ·
[[agent-integration]] · [[decisions/_MOC]] ·
[[2026-07-13-review-collaboration-security-design]]
