---
type: domain
tags: [domain]
aliases: [Review, review]
---

# Review

- **Definition:** An explicit human-or-worker gate on a [[WorkUnit]] — approval,
  rejection, or change request. The protocol's human-in-the-loop primitive
  (Design Principle 4.5).
- **Canonical name:** Review. Never "approval" alone (approval is one outcome).
- **Not:** a [[Checkpoint]] (progress) nor a code review comment thread.
- **States:** `requested · approved · rejected · changes_requested · cancelled`.
- **Requirements:** a review carries a set of requirement tags (`diff_review`,
  `tests_pass`, …) that must hold before approval.
- **Effect on work:** `approved` ⇒ WorkUnit may advance to `approved`; `rejected` ⇒
  `rejected`; `changes_requested` ⇒ back to `running`.
- **Example:** `review_123` requested by `agent_claude_code`, reviewer `human_chris`.

## Referenced by

(maintained by Forensic Guardian)
