---
type: decision
status: PROPOSED
date: 2026-07-13
tags: [adr, backlog, auth, workspace, security]
aliases: [ADR-0014, workspace-administration-authority]
---

# ADR-0014 — Isolate Workspace Administration Authority

## Status

PROPOSED / BACKLOG. This independent follow-up is deliberately outside
[[ADR-0013-review-collaboration-permission]]. It records the remaining authority
problem without delaying or weakening the accepted collaboration boundary.

## Context

Removing `workspace:write` from worker and reviewer collaboration tokens closes
their administration exposure. The broader vocabulary still combines workspace
create, update, and archive. Update has an existing target and can enforce a
workspace binding; create has no target yet, and archive authorization currently
does not express a dedicated host-operator/provisioner policy.

## Problem

Hosted ACP needs an explicit answer for who may provision and retire workspace
tenants. Reusing an ordinary workspace-bound mutation scope for target creation
or host-wide archival makes the binding model ambiguous.

## Candidate direction

Define a host-administration or provisioner capability for create and any truly
host-wide operation, retain target-derived binding for update/archive where
applicable, and specify bootstrap/recovery policy separately from agent roles.
The final permission names and operator trust model require their own grill and
deployment migration plan.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT put `workspace:write` back into canonical worker/reviewer tokens.
- ❌ Do NOT infer host-administrator authority from a workspace binding.
- ❌ Do NOT let this backlog block the accepted `review:collaborate` /
  `review:respond` migration.

## Validation backlog

- Hosted workspace create, update, and archive each have an explicit permission
  and target/host authority rule.
- Workspace-bound non-administrators are denied all provisioning operations.
- Bootstrap, disaster recovery, and external-identity mappings are documented
  and tested before the decision becomes accepted.

## Referenced by

[[ADR-0013-review-collaboration-permission]] · [[decisions/_MOC]] ·
[[architecture/_MOC]] · [[agent-integration]] ·
[[CHANGELOG]] · [[2026-07-13-review-collaboration-security-design]]
