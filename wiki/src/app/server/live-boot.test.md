---
type: module
path: '@root/src/app/server/live-boot.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, boot, socket]
aliases: [live-boot.test]
---

# Live Boot Tests

## Purpose

Prove [[http-app]] boots the real Node HTTP stack on a collision-free socket and
serves health, readiness, session bootstrap, and scoped mutation end to end.

## Interface

Vitest integration suite providing `HttpAppLive` to `nodeHttpServerLayer(0)` and
reading the OS-assigned address from `HttpServer`.

## Algorithm

Bind a real TCP socket, fetch `/health` and `/ready`, initialize a session, and
create scoped work using the minted bearer. Require successful statuses,
canonical protocol `0.1`, a secure session-token shape, open work state, and
actor attribution to the initialized worker. The Effect scope tears the socket
down after the scenario.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT replace this with another in-process web-handler test.
- ❌ Do NOT bind fixed port 4317 in CI or concurrent runs.
- ❌ Do NOT import the launching `server-main` module into tests.
- ❌ Do NOT create work without forwarding the minted bearer token.
- ❌ Do NOT leak the server fiber beyond the test scope.

## Grill Log

- **Q:** What unique risk does this catch? **A:** Layer composition can pass
  handler tests while socket binding, route serving, or runtime provisioning is
  broken. _Rejected:_ treating handler coverage as proof of production boot.

## Referenced by

[[http-app]] · [[node-http-server]] · [[server-main]] · [[server/_MOC]] ·
[[Transport]] · [[src/_MOC]]
