---
type: module
path: '@root/src/infrastructure/auth/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, barrel, auth]
aliases: [auth-index]
---

# Infrastructure Auth Index

## Purpose

Expose only the production [[session-issuer-live]] Layer and shared
Authorization-header credential reader to the application/transport boundary.

## Interface

Re-export `SessionIssuerLive` and `bearerCredential`; do not expose static policy
internals or credential-matching helpers to callers.

## Algorithm

Static ESM re-export with explicit `.js` path.

## Negative Logic

- Do not create a second service instance.
- Do not export policy credential digests.

## Depth

SHALLOW by design: an opaque import boundary.

## Referenced by

[[auth/_MOC]] · [[app-live]] · [[acp-router]] · [[acp-rpc-handlers]]
