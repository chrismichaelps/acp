---
type: domain
tags: [domain]
aliases: [Checkpoint, checkpoint]
---

# Checkpoint

- **Definition:** A resumable summary of partial progress on a [[WorkUnit]], so any
  [[Worker]] can stop, crash, or hand off work without losing useful state
  (Design Principle 4.7 — Recoverable work).
- **Canonical name:** Checkpoint. Never "snapshot", never "save".
- **Not:** an [[Artifact]] (a deliverable) nor a [[Review]] (an approval step).
- **Shape:** `summary`, `completed_steps[]`, `remaining_steps[]`, `modified_resources[]`.
- **Append-only:** checkpoints accumulate; the latest is the resume point. Mirrors the
  protocol's [[Event]] philosophy.
- **Example:** `checkpoint_123` "Found async redirect issue; test added; fix pending".

## Referenced by

(maintained by Forensic Guardian)
