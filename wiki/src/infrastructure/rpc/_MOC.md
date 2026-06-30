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
- [[acp-rpc-artifact-handlers]] — native artifact evidence handlers split from
  the aggregate handler layer.
- [[acp-rpc-checkpoint-handlers]] — native checkpoint resume handlers split from
  the aggregate handler layer.
- [[acp-rpc-review-handlers]] — native human review gate handlers split from the
  aggregate handler layer.
- [[rpc-auth]] — bearer-session authorization helper for native RPC handlers.
- [[rpc-auth-middleware]] — contract-annotated native RPC authorization
  middleware.
- [[rpc-error]] — domain-error to `ProtocolError` mapper for native RPC.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
