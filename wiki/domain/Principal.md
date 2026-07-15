---
type: domain
tags: [domain, identity, security]
aliases: [Principal, external principal, service principal]
---

# Principal

- **Definition:** A stable identity verified outside ACP and authorized by a
  [[SessionIssuance]] policy to act as exactly one [[Worker]].
- **Canonical name:** Principal. Never infer it from a caller-supplied worker id,
  display name, credential, or ACP session.
- **Identity:** `(issuer_id, principal_id)` is immutable and host-scoped.
- **Attribution:** A principal's `worker_id` binding is immutable once persisted.
  Display name, vendor, status, capabilities, permissions, workspaces, credential
  digest, and revision may change; neither principal nor worker id may be reused.
- **Deprovisioning:** Disabling a principal denies new issuance and existing
  sessions but retains its durable identity/worker tombstone.
- **Credential:** Proves access to the policy entry; it is not the principal id
  and is never stored in plaintext.
- **Not:** An ACP [[Worker]] (protocol actor), session (bearer lifetime), or
  operator account.

## Referenced by

[[domain/_MOC]] · [[Worker]] · [[ADR-0015-trusted-session-issuance]] ·
[[SessionIssuance]] · [[session-issuer-live]] · [[trusted-session-issuance]]
