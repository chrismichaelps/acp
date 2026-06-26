# Changelog

Temporal ledger of logic deltas (one line each). Forensic Guardian appends.

- 2026-06-25 · vault · FMCF Mode 1 scaffold: grammar, domain glossary (8),
  [[architecture/LANGUAGE]], seams (Storage/Transport/EventStream), MOCs ·
  risk LOW · [[ADR-0001-architecture-foundation]]
- 2026-06-25 · protocol-schema slice · projected schema pages to code: branded
  [[ids]], [[common]] vocabularies, 8 entity schemas, [[event.schema]],
  [[error.schema]], tagged [[protocol-error]] (total spec §15 mapping), [[app-config]]
  (typed ACP\_\* config, orDie on invalid) · 14 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
- 2026-06-25 · storage slice · projected [[Storage]] seam to code: [[storage-index]],
  [[storage]] port, [[in-memory-store]] adapter, storage MOCs, and adapter tests for
  KV state plus append-only per-workspace [[Event]] seqs · 20 tests green · risk LOW ·
  [[ADR-0001-architecture-foundation]]
