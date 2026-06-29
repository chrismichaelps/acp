---
type: reference
tags: [reference, storage, memory]
aliases: [workspace-memory-records, memory-storage-shape]
---

# Workspace Memory Records

[[Memory]] records answer the remaining v0.1 memory question with a bounded host
feature: agents can pass durable, queryable context between workers without
turning checkpoints into a knowledge base or artifacts into small notes. The
record is workspace-owned, optionally tied to a [[WorkUnit]], append-oriented,
and emitted as `memory.created` so live clients can observe it.

The storage shape must handle thousands of records per workspace. The default
read path is chronological replay by `(workspace_id, seq)`, which matches the
existing [[Event]] replay model. Key and work filters are secondary handoff
paths, not replacements for the cursor. A label index can be added later if
filter telemetry proves it is hot; the first implementation should not pay that
write cost preemptively.

```sql
CREATE TABLE memory (
  workspace_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  id TEXT NOT NULL,
  work_id TEXT,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  labels_json TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, seq),
  UNIQUE (workspace_id, id)
) WITHOUT ROWID;

CREATE INDEX memory_workspace_key_seq
  ON memory (workspace_id, key, seq);

CREATE INDEX memory_workspace_work_seq
  ON memory (workspace_id, work_id, seq);
```

The implementation slice should keep [[sqlite-store]] prepared-statement based
and avoid generic `kv` scans for memory reads. It should also split route/API
surface area into capability-specific files before adding handlers because
[[acp-router]] and [[acp-http-api]] are already near the source-size ceiling.

## Referenced by

[[Memory]] · [[protocol-implementation-2026-06-28]]
