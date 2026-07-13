---
type: decision
status: PROPOSED
date: 2026-07-12
tags: [adr, backlog, auth, review, security]
aliases: [ADR-0013, review-collaboration-permission]
---

# ADR-0013 — Narrow Review Collaboration Permission

## Status

PROPOSED / BACKLOG. This page records a residual v0.1 security limitation; the
current documentation slice does not change server authorization.

## Context

The complete reviewer loop needs to create/resolve/reopen inline comments and
operate grills. Those routes currently require `workspace:write`. That same
scope also authorizes workspace creation, update, and archive. Update checks a
target workspace binding, while create and archive use non-target authorization.

Consequently the nine-scope reviewer bootstrap in [[agent-integration]] is the
minimum expressible set under the closed v0.1 vocabulary, but it is not
capability-isolated least privilege.

## Decision

In a future protocol slice:

1. Add a dedicated review-collaboration permission (working name
   `review:collaborate`) for inline-comment and grill mutations.
2. Apply target-derived workspace binding checks to every collaboration route
   across REST, native RPC, and compatibility transports.
3. Remove `workspace:write` from the canonical reviewer bootstrap after live
   migration evidence passes.
4. Separately define workspace administration authority so create/archive do
   not bypass the intended hosted binding boundary. Workspace creation may need
   an explicit host-admin/provisioner role because its target does not yet exist.

The final permission spelling and migration compatibility require a protocol
version decision; `review:collaborate` is a working backlog name, not a shipped
v0.1 token.

## Rationale

Review collaboration and workspace administration are independent capabilities.
Keeping them under one scope violates least-privilege isolation and makes a
workspace-bound reviewer more powerful than its documented role.

## Rejected alternatives

- **Call the current token least privilege.** Rejected: accurate only as a
  minimum union of current scopes, not as capability isolation.
- **Drop comments/grills from the reviewer loop.** Rejected: weakens the review
  gate and contradicts shipped behavior.
- **Change server scopes in the documentation repair.** Rejected: permission
  vocabulary, all transports, compatibility, migration, and binding semantics
  need a dedicated reviewed slice.

## Validation backlog

- Contract tests pin the new permission on every comment/grill mutation.
- Workspace-bound collaboration is denied across workspaces.
- Reviewer session no longer carries `workspace:write`.
- Workspace create/archive authority has explicit hosted-mode tests.
- Docker self-dogfood proves the migrated reviewer loop and denial boundaries.

## Referenced by

[[agent-integration]] · [[decisions/_MOC]] ·
[[2026-07-12-acp-skill-reviewer-bootstrap]]
