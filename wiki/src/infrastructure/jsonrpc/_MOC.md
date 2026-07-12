---
type: moc
tags: [moc, src, infrastructure, jsonrpc]
---

# JSON-RPC Source MOC

Mirror of `@root/src/infrastructure/jsonrpc/`.

- [[jsonrpc-index]] — opaque public JSON-RPC exports.
- [[json-rpc]] — JSON-RPC 2.0 method normalization into canonical ACP transport commands.
- [[json-rpc.test]] — broad envelope, id, error, and method projection contract.
- [[json-rpc-command-support]] — shared JSON-RPC command ids, errors, response shapes, and param decoding.
- [[json-rpc-lease-commands]] — lease readback and lifecycle method mappings.
- [[json-rpc-lease-commands.test]] — encoded lease list/renew/revoke projection contract.
- [[json-rpc-worker-commands]] — host-scoped worker read method mappings.
- [[json-rpc-worker-commands.test]] — host-scoped worker collection/item projection contract.
- [[json-rpc-resume-commands]] — work-scoped read/query method mappings.
- [[json-rpc-resume-commands.test]] — work/workspace evidence and content-read route contract.
- [[json-rpc-event-commands]] — event replay and live subscription method mappings.
- [[json-rpc-event-commands-test]] — focused event JSON-RPC command mapping regressions.
- [[json-rpc-memory-commands]] — workspace memory create/list method mappings.
- [[json-rpc-memory-commands.test]] — memory body, optional-filter, and workspace-scope contract.
- [[json-rpc-command-map]] — closed JSON-RPC method table mapping to ACP HTTP commands.
- [[json-rpc-review-commands.test]] — signed approval and dedicated cancellation projection contract.
- [[json-rpc-runtime]] — executes the normalized commands and folds outcomes into JSON-RPC responses.
- [[json-rpc-runtime.test]] — folding, batches, notifications, live dispatch, and scope contract.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
