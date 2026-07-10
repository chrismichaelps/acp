---
type: domain
tags: [domain]
aliases: [Host, ACP Host]
---

# Host

- **Definition:** The ACP application process that owns configured storage,
  composes domain services, and serves protocol transports and health probes.
- **Canonical name:** Host.
- **Not:** A [[Worker]] performing work, nor a [[Workspace]] containing work.
- **States:** alive (process serves) and ready (required dependencies answer).
- **Example:** One Docker ACP replica serving `/health`, `/ready`, REST, and RPC.

## Referenced by

[[health-routes]] · [[http-app]] · [[architecture/LANGUAGE]] · [[domain/_MOC]]
