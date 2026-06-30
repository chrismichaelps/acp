---
type: moc
tags: [moc, src, infrastructure, jsonrpc]
---

# JSON-RPC Source MOC

Mirror of `@root/src/infrastructure/jsonrpc/`.

- [[jsonrpc-index]] — opaque public JSON-RPC exports.
- [[json-rpc]] — JSON-RPC 2.0 method normalization into canonical ACP transport commands.
- [[json-rpc-command-support]] — shared JSON-RPC command ids, errors, response shapes, and param decoding.
- [[json-rpc-lease-commands]] — lease lifecycle method mappings.
- [[json-rpc-worker-commands]] — host-scoped worker read method mappings.
- [[json-rpc-resume-commands]] — work-scoped read/query method mappings.
- [[json-rpc-event-commands]] — event replay and live subscription method mappings.
- [[json-rpc-memory-commands]] — workspace memory create/list method mappings.
- [[json-rpc-command-map]] — closed JSON-RPC method table mapping to ACP HTTP commands.
- [[json-rpc-runtime]] — executes the normalized commands and folds outcomes into JSON-RPC responses.

## Referenced by

[[infrastructure/_MOC]] · [[src/_MOC]]
