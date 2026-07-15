---
type: module
path: '@root/src/app/server/session-workspace-binding.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, session, workspace, auth]
aliases: [session-workspace-binding.test]
---

# Session Workspace Binding Tests

## Purpose

Prove hosted-style configuration refuses host-wide bearer sessions and persists
the explicit workspace binding returned by session initialization.

## Interface

Vitest suite overriding `AppConfigTag` with Postgres/pg-notify, required auth,
and `requireWorkspaceBindings=true` over the in-process [[acp-router]].

## Algorithm

The fixture selects local trusted-client issuance while requiring bindings, so
this legacy boundary test remains distinct from static policy grant derivation.

Initialize the same worker and permissions with no `workspace_ids`, an empty
array, and one concrete workspace. Require HTTP 400 for missing and empty
bindings, HTTP 200 for the bound request, and exact echo of the persisted
workspace id.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT treat an empty binding list as host-wide access in hosted mode.
- ❌ Do NOT mint a session before validating required workspace scope.
- ❌ Do NOT silently drop the accepted binding from the session response.
- ❌ Do NOT apply this requirement to profiles where the config disables it.

## Grill Log

- **Q:** Why test both missing and empty? **A:** They are distinct wire shapes
  but equally unsafe under hosted policy. _Rejected:_ accepting an explicitly
  empty array as a deliberate global session.

## Referenced by

[[acp-router]] · [[app-config]] · [[session-service]] · [[server/_MOC]] ·
[[Transport]] · [[src/_MOC]]
