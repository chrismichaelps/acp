---
type: module
path: '@root/src/app/cli/lease-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-lease-commands]
---

# CLI Lease Commands

## Purpose

Own the lease lifecycle CLI command map consumed by [[cli-commands]]. Lease
request, readback, renewal, release, and revocation have enough validation and
route-shaping detail to live outside the central parser registry while preserving
the same `parseArgs` public contract.

## Interface

```typescript
export const leaseCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`lease request --workspace --holder --kind --uri [--ttl]` maps to
`POST /v1/leases`. `lease list --workspace <id> [--holder <holder>]` maps to
`GET /v1/leases?workspace_id=` and, when `--holder` is supplied, records a
client-side `holder` filter for [[cli-client]]. `lease release`, `lease renew`,
and `lease revoke` map to their lease-id scoped lifecycle routes.

## Algorithm

`lease request` requires workspace, holder, resource kind, and resource URI,
then includes `ttl_seconds` only when `--ttl` is present and validates it as a
positive safe integer before the request reaches HTTP decoding. `lease list`
URL-encodes the workspace query parameter and may carry a `holder` client filter
so an agent can recover only its own active lease claims without changing the
host route. Release and revoke share the same state-command helper because both
are bodyless `POST` transitions. Renew accepts an optional positive `--ttl`;
when it is absent, the host applies its configured default lease TTL.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT acquire or mutate leases here; this module only builds `CliRequest`
  data.
- ❌ Do NOT pass raw workspace or lease ids into routes; path and query values
  are encoded at parse time.
- ❌ Do NOT filter lease responses here; [[cli-client]] applies client filters
  after fetch.
- ❌ Do NOT add unrelated command groups here.

## Depth

MEDIUM (0.55). It isolates lease-specific parser rules behind an additive
command map, reducing the central CLI parser's file-size pressure and keeping
new lease actions local to one module.

## Referenced by

[[lease-commands.test]] · [[cli-commands]] · [[cli/_MOC]]
