---
date: 2026-07-12
topic: acp-skill-reviewer-bootstrap
from_role: Forensic Guardian
to_role: Maintainer
status: COMPLETE
maturity: EXPLORING
tags: [handoff, auth, review, dogfood]
---

# Handoff — ACP Skill Reviewer Bootstrap

## Done

- Audited actual review, review-comment, grill, memory, event, and resume route
  authorization; no server permission mapping required a change.
- Updated canonical [[agent-integration]] first, then projected the exact
  workspace-bound reviewer bootstrap into `@root/ACP-SKILL.md`.
- Extended the permission documentation guard with an exact reviewer scope set
  and focused drift/failure regressions.
- Expanded hardened Docker auth dogfood so a verdict-only reviewer is denied
  comment and memory creation, while the documented reviewer comments, resolves,
  persists/reads a durable observation, replays events, and approves.
- Ran the reviewer scenario against `acp:latest`. The first run exposed the
  unsupported memory kind `finding`; using the protocol’s `observation` kind
  made the complete scenario pass.
- Renumbered the proposed collaboration backlog to
  [[ADR-0013-review-collaboration-permission]] after review identified the
  primary branch's accepted ADR-0012 namespace owner.

## Decided (do not re-litigate)

- Reviewer scopes are `workspace:read`, `workspace:write`, `event:read`,
  `memory:create`, `memory:read`, `review:approve`, `review:reject`,
  `review:request_changes`, and `review:cancel`.
- `workspace:write` intentionally authorizes inline-comment and grill mutations;
  it does not grant work-unit mutations.
- Reviewer tokens exclude `work:*`, lease, checkpoint, artifact, and
  `review:create` scopes to preserve separation from the worker role.
- The nine scopes are the minimum expressible v0.1 union, not
  capability-isolated least privilege. Required `workspace:write` also grants
  workspace create/update/archive; create/archive are not target-bound.

## Residual risk and backlog

- **Risk:** a compromised workspace-bound reviewer can administer workspaces
  beyond the collaboration behavior described by the role.
- **Backlog:** implement [[ADR-0013-review-collaboration-permission]] so comment
  and grill mutations no longer require `workspace:write`, and harden workspace
  administration binding/authority separately.

## Validation

- `node scripts/check-agent-doc-permissions.mjs`
- Focused permission-guard and Docker orchestration Vitest suites
- ESLint on changed support scripts
- Focused hardened Docker reviewer probe against `acp:latest`

## Exact next action

Maintainer: review the cumulative uncommitted isolated-worktree diff, run the
full repository gate, then integrate it into the active feature branch.

## Links

[[agent-integration]] · [[deployment]] · [[session-commands]]
