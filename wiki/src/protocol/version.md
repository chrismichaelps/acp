---
type: module
path: '@root/src/protocol/version.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
domain: '[[Worker]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, protocol, deep]
aliases: [protocol-version, ACP_PROTOCOL_VERSION]
---

# Protocol Version

## Purpose

Own the canonical ACP protocol version and supported-version predicate used by
session initialization. The module is the single place where v0.1 compatibility
is declared before transport edges advertise or reject a client handshake.

## Interface

### Signatures

```typescript
export const ACP_PROTOCOL_VERSION = '0.1' as const
export const SUPPORTED_PROTOCOL_VERSIONS: readonly ['0.1']
export type ProtocolVersion = '0.1'
export const ProtocolVersion: Schema.Literal<['0.1']>
export const isSupportedProtocolVersion: (
  version: string,
) => version is ProtocolVersion
```

### Linkage

- **Requires:** `effect/Schema`
- **Consumed by:** [[schema-index]], [[acp-http-api]], [[acp-router]]

## Algorithm

Expose the current protocol version as a literal constant, derive the supported
set from that constant, and use a pure membership predicate for compatibility.
The [[acp-http-api]] request schema accepts a string so the router can perform a
named handshake decision. Successful responses encode the literal
`ProtocolVersion` schema.

[[ADR-0016-version-bump-policy]] permits the repository-local [[version-bump]]
tool to replace exactly the current constant literal after an explicit protocol
level is selected. The supported tuple, type, schema, and predicate continue to
derive from that one constant; the tool must not rewrite them independently.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate `'0.1'` in transport responses or payload defaults.
- ❌ Do NOT add future versions without a compatibility decision and test.
- ❌ Do NOT infer a protocol level from a source diff.
- ❌ Do NOT create generated clients or generic codecs from this module.

## Depth

DEEP (0.72). The interface is tiny, but it prevents string-literal drift across
the protocol boundary and gives future compatibility work a single module to
change.

## Referenced by

[[ADR-0004-protocol-version-codecs-generated-client]] ·
[[ADR-0016-version-bump-policy]] · [[version-bump]] ·
[[protocol-version.test]] · [[protocol/_MOC]] · [[src/_MOC]]
· [[2026-07-13-acp-release-1.1.0]]
