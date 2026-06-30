---
type: moc
tags: [moc, src, infrastructure, rpc]
---

# Effect RPC Source MOC

Mirror of `@root/src/infrastructure/rpc/`. This folder owns the native
first-party Effect RPC contract selected by [[ADR-0007-effect-rpc-adoption]].

- [[rpc-index]] — opaque native RPC infrastructure barrel.
- [[acp-rpc-contract]] — native first-party `RpcGroup` contract over ACP schemas.
- [[acp-rpc-handlers]] — native handler verticals for session, worker,
  workspace, work, and lease operations.
- [[rpc-auth]] — bearer-session authorization helper for native RPC handlers.
- [[rpc-error]] — domain-error to `ProtocolError` mapper for native RPC.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
