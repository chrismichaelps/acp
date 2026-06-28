---
type: domain
tags: [domain]
aliases: [Worker, worker]
---

# Worker

- **Definition:** Any actor that performs or supervises work — agent, human, bot,
  CI, or system. Identified by a stable `WorkerId`, scoped by permissions.
- **Canonical name:** Worker. Never "agent" alone (an agent is one `kind` of worker),
  never "user".
- **Not:** a [[Workspace]] (where work happens) nor a session (a connection lifetime).
- **Kinds:** `human · agent · bot · ci · system`.
- **Status:** `online · idle · busy · blocked · offline`.
- **Capabilities:** declared at session initialize (`can_edit_files`, `can_review`,
  `supports_leases`, …) — a [[Worker]] holds a `HashSet` of capability flags.
- **Presence scope:** status is host-scoped registry state in v0.1, not
  workspace event history; see [[ADR-0005-worker-presence-scope]].
- **Trust:** the [[Host]] treats every worker as **untrusted** (spec §19).
- **Example:** `agent_claude_code` (kind agent, vendor anthropic), status online.

## Referenced by

[[worker-service]] · [[worker.schema]] · [[ADR-0005-worker-presence-scope]]
