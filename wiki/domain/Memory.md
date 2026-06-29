---
type: domain
tags: [domain]
aliases: [Memory, memory, MemoryRecord, memory record]
---

# Memory

- **Definition:** Workspace-scoped, append-oriented coordination context that
  lets a [[Worker]] leave durable recall for later workers without replaying the
  full [[Event]] log.
- **Canonical name:** Memory. Use "memory record" for one persisted item.
- **Not:** a [[Checkpoint]] (resumable work progress), an [[Artifact]] (large or
  deliverable evidence), or a chat transcript.
- **Shape:** `workspace_id`, monotonic `seq`, optional `work_id`, `created_by`,
  `kind`, `key`, `summary`, `content`, `labels[]`, and `created_at`.
- **Kinds:** `note · decision · observation · constraint · handoff · custom`.
- **Storage:** optimized for `(workspace_id, seq)` cursor reads plus key/work
  filters; see [[workspace-memory-records]].
- **Example:** `memory_123` key `auth.redirect.async-session`, kind decision,
  summary "Redirect waits for session creation before navigating."

## Referenced by

[[domain/_MOC]] · [[workspace-memory-records]]
