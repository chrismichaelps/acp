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

1. Resolve the original ACP review comment with the completed evidence.
2. Obtain a green ACP grill and independent re-review.
3. Merge PR #332 and close issue #327 only after GitHub checks remain green.

Completed evidence: exact mirror audit `260/260`; focused Docker tests `18/18`;
typecheck, lint, changed-file formatting, file-size, permission, environment,
edge-pin, and OpenAPI drift policies green; clean Linux suite `646 passed`, `13`
intentional skips; production build `153` runtime files. The repository-wide
format command also reports ten pre-existing `.superpowers/sdd/*` Markdown files
outside this feature; every issue #327 path passes Prettier.

Production image evidence: complete SQLite lifecycle and restart persistence;
hardened auth; REST, SSE, JSON-RPC HTTP/stdio/WebSocket, and native RPC; two-node
HA/Postgres with claim and lease contention, expiry, changes-requested, signed
approval, and completion; SQLite and two-node HA edge routing. A fresh repaired
production container served 47 paths/53 operations with exactly one public
bootstrap, 52 `AcpSession`-protected operations carrying `401` and `403`
responses, JSON content type, and POST `/openapi.json` → 404. The Docker
coordination container restarted against its original named volume and recovered
this work and its checkpoints.

First ACP review result: **NO-GO**. The production router exposes 53 `/v1`
operations while the generated document exposed only 40. Thirteen existing
review-comment and grill routes were mounted outside `AcpHttpApi`, and
representative-path tests could not detect the omission. The review also found
that protected operations did not consistently advertise `401` and `403`, and
that the documentation overstated byte equality as semantic compatibility
enforcement. These findings are release blockers, not deferred cleanup.

Resolution at `0cf3992`: [[acp-http-api-reviews]] declares all 13 omitted live
operations, [[openapi-module]] projects standard auth errors, both typed and
generated contracts compare exactly with all 53 production registrations, and
the regenerated artifact passed the complete validation matrix above.

## Exact Next Action

Resolve `reviewcomment_mrld2e9j8`, answer and adjudicate every open grill question
with the completed Docker evidence, then ask the same ACP reviewer to reassess
the repaired diff before approving or merging.

## Referenced by

[[ADR-0017-openapi-contract-artifact]] · [[openapi-module]] ·
[[openapi-module.test]] · [[openapi-route]] · [[openapi-route.test]] ·
[[grammar/typescript]]
