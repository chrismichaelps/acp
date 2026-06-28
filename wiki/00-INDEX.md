---
type: index
tags: [index]
---

# ACP Vault — Index (MOC of MOCs)

**Agent Coordination Protocol (ACP)** reference implementation. The wiki is the
truth; code is a projection of it (FMCF v4.0). Build the wiki first, then code the wiki.

> Front door. Open a `_MOC` to navigate a folder. Maturity: **EXPLORING**.

## Maps of Content

- [[architecture/_MOC|Architecture]] — layer topology, seam health, depth dashboard, build order.
- [[domain/_MOC|Domain]] — the ACP glossary (Worker, Workspace, WorkUnit, Lease, …).
- [[seams/_MOC|Seams]] — Storage, Transport, EventStream boundaries.
- [[decisions/_MOC|Decisions]] — ADRs.
- [[src/_MOC|Source Mirror]] — 1:1 mirror of `@root/src/`.

## Law Anchors

- Grammar (Law 4): [[grammar/typescript]] — pinned SDK versions, real imports, prohibited patterns.
- Vocabulary: [[architecture/LANGUAGE]] — Ousterhout-grounded architecture terms.
- Ledger: [[CHANGELOG]] — temporal log of logic deltas.
- Handoffs: `wiki/handoffs/` — session/role continuity.
- External alignment: [[external-protocols]] — how ACP relates to MCP and IBM/LF ACP.
- Spec canonicalization: [[spec-canonicalization]] — how to read the ignored
  Hadoof-era draft through the tracked ACP naming decision.

## Source of Truth

- Spec: `@root/specs.md` (ignored local draft). Older sections name "Hadoof";
  per [[ADR-0001-architecture-foundation]] and [[spec-canonicalization]], the
  canonical tracked name is **ACP**.
- Governance: `@root/SKILL.md` (FMCF v4.0).
