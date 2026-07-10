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
- [[rpc-resource-workspace-auth]] — derived workspace authorization for native
  RPC work and lease resource ids.
- [[rpc-auth-middleware]] — contract-annotated native RPC authorization
  middleware.
- [[rpc-telemetry-middleware]] — wrap-style native RPC completion telemetry
  using Effect log annotations and spans.
- [[rpc-error]] — domain-error to `ProtocolError` mapper for native RPC.
- [[acp-rpc-test-support]] — shared native RPC test runtime and payload helpers.
- [[acp-rpc-roundtrip.test]] — first generated-client contract smoke test.
- [[acp-rpc-roundtrip-work-lease.test]] — generated-client coverage for
  worker, workspace, work, and lease methods.
- [[acp-rpc-roundtrip-artifact-checkpoint.test]] — generated-client coverage
  for artifact evidence and checkpoint resume methods.
- [[acp-rpc-roundtrip-review-memory-event.test]] — generated-client coverage
  for review gates, memory records, and event listing.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
