---
type: domain
tags: [domain]
aliases: [Event, event]
---

# Event

- **Definition:** An immutable, append-only record of something that happened in a
  [[Workspace]]. The protocol is **state-first**: workers coordinate by publishing
  events, not by chatting (Design Principle 4.1, 4.6).
- **Canonical name:** Event. Never "message", never "notification".
- **Not:** a chat message — events are typed protocol facts, not free text.
- **Shape:** `id`, `type`, `workspace_id`, `actor`, `timestamp`, `data`, plus optional
  `work_id`. Carries a monotonic sequence for ordered replay.
- **Type families:** `workspace.* · work.* · lease.* · artifact.* · checkpoint.* ·
review.*` are emitted by the v0.1 reference host when backed by persisted
  workspace transitions. `worker.*` names are reserved draft vocabulary, but
  [[ADR-0005-worker-presence-scope]] keeps presence out of workspace event logs.
- **Delivery:** persisted via the [[Storage]] seam, fanned out live via the
  [[EventStore]] service, then rendered by the [[EventStream]] seam (SSE in v0.1).
- **Example:** `event_123` type `work.claimed`, actor `agent_claude_code`.

## Referenced by

[[event-store]] · [[event-store-index]] · [[ADR-0005-worker-presence-scope]]
