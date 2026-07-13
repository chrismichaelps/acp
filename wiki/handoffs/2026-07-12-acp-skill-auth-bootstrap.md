---
date: 2026-07-12
topic: acp-skill-auth-bootstrap
from_role: Forensic Guardian
to_role: Maintainer
status: COMPLETE
maturity: EXPLORING
tags: [handoff, auth, dogfood]
---

# Handoff — ACP Skill Auth Bootstrap

## Done

- Updated canonical [[agent-integration]] before projecting the executable,
  workspace-bound, exact-scope worker bootstrap into `@root/ACP-SKILL.md`.
- Reconciled the existing [[session-commands]] mirror with its repeated and
  comma-separated `--workspace` behavior.
- Strengthened `@root/scripts/check-agent-doc-permissions.mjs` so vocabulary,
  workspace binding, and exact worker-loop permission closure cannot drift.
- Extended Docker self-dogfood to provision workspace state first, restart the
  same SQLite volume with auth and mandatory workspace bindings, then execute
  the complete documented worker lifecycle with a separate reviewer session.
- Ran the hardened probe against `acp:latest`; it passed after correcting the
  probe to accept the intentionally empty successful `lease release` response.

## Decided (do not re-litigate)

- Worker tokens contain only the scopes their documented loop exercises.
  `workspace:write` and reviewer decision scopes are intentionally excluded.
- Workspace provisioning precedes the mandatory-binding runtime; the strict
  worker session binds to an existing workspace.
- Approval uses an independently bound reviewer token, preventing self-approval.

## Validation

- `node scripts/check-agent-doc-permissions.mjs`
- Focused Vitest: documentation guard and Docker self-dogfood orchestration
- ESLint on all changed support scripts
- Focused real Docker auth probe against `acp:latest`

## Exact next action

Maintainer: review the uncommitted isolated-worktree diff, run the full repository
gate, then integrate it into the active feature branch.

## Links

[[agent-integration]] · [[session-commands]] · [[deployment]]
