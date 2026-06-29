---
type: domain
tags: [domain]
aliases: [Artifact, artifact]
---

# Artifact

- **Definition:** A durable output of work produced by a [[Worker]] under a
  [[WorkUnit]] — the evidence of what the work produced.
- **Canonical name:** Artifact. Never "output", never "result".
- **Not:** a [[Checkpoint]] (progress state, not a deliverable).
- **Kinds:** `patch · diff · commit · pull_request · test_report · log · screenshot ·
markdown · json · binary · custom`.
- **Storage:** content may be host-stored (`acp://artifacts/{id}`) or externally
  referenced by URI. Size bounded by `ACP_MAX_ARTIFACT_SIZE`.
- **Example:** `artifact_123`, kind patch, media `text/x-patch`, "Fixes auth redirect timing".

## Referenced by

(maintained by Forensic Guardian)
