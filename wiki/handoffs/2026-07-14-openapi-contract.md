---
type: handoff
status: active
date: 2026-07-14
issue: 327
pr: 332
tags: [handoff, openapi, docker-self-host]
aliases: [2026-07-14-openapi-contract]
---

# OpenAPI Contract Handoff

## Recovered Work

- Branch: `feat/openapi-export`; PR #332; issue #327.
- Docker ACP project: `acp-self-openapi`; workspace `workspace_mrlaz3fq1`;
  work `work_mrlaz41o2`.
- The branch already generated and served `openapi.json`, but four new source
  files lacked exact wiki mirrors and the generated contract advertised all
  protected operations as anonymous.
- Existing tests covered identity, representative paths, determinism, artifact
  drift, and a successful live GET only.

## Decisions

- [[ADR-0017-openapi-contract-artifact]] defines the generated artifact, public
  discovery endpoint, router-auth security repair, and same-version 0.x
  compatibility envelope.
- [[openapi-module]] uses upstream `OpenApi.OpenAPISpec`, declares `AcpSession`,
  and keeps only `session.initializeSession` public.
- [[openapi-route]] serves one in-memory projection and never reads the artifact.
- Native Effect RPC and generated language clients remain outside issue #327.

## Remaining

1. Push the completed commits and attach PR #332 as ACP review evidence.
2. Open an ACP grill, obtain independent review, and resolve any findings.
3. Merge PR #332 and close issue #327 when GitHub checks and ACP review are green.

Completed evidence: exact mirror audit `259/259`; focused Docker tests `7/7`;
typecheck, lint, changed-file formatting, file-size, permission, environment,
edge-pin, and OpenAPI drift policies green; clean Linux suite `644 passed`, `13`
intentional skips; production build `152` runtime files. The repository-wide
format command also reports ten pre-existing `.superpowers/sdd/*` Markdown files
outside this feature; every issue #327 path passes Prettier.

Production image evidence: complete SQLite lifecycle and restart persistence;
hardened auth; REST, SSE, JSON-RPC HTTP/stdio/WebSocket, and native RPC; two-node
HA/Postgres with claim and lease contention, expiry, changes-requested, signed
approval, and completion; SQLite and two-node HA edge routing. A fresh
`acp:latest` container served 35 paths/40 operations with exactly one public
bootstrap, 39 `AcpSession`-protected operations, JSON content type, and POST
`/openapi.json` → 404. The Docker coordination container restarted against its
original named volume and recovered this work and its checkpoints.

## Exact Next Action

Reviewer role: inspect the complete branch diff against `main`, challenge auth
truthfulness, same-version stability, drift enforcement, and production wiring,
then accept or reject each ACP grill question before approving review.

## Referenced by

[[ADR-0017-openapi-contract-artifact]] · [[openapi-module]] ·
[[openapi-module.test]] · [[openapi-route]] · [[openapi-route.test]] ·
[[grammar/typescript]]
