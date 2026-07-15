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

1. Commit the completed implementation and regenerated artifact.
2. Run the production Docker self-dogfood and verify the live container's
   `/openapi.json` contract.
3. Attach PR evidence, open an ACP grill, obtain independent ACP review, resolve
   findings, merge PR #332, and close issue #327.

Completed evidence: exact mirror audit `259/259`; focused Docker tests `7/7`;
typecheck, lint, changed-file formatting, file-size, permission, environment,
edge-pin, and OpenAPI drift policies green; clean Linux suite `644 passed`, `13`
intentional skips; production build `152` runtime files. The repository-wide
format command also reports ten pre-existing `.superpowers/sdd/*` Markdown files
outside this feature; every issue #327 path passes Prettier.

## Exact Next Action

Verifier role: commit the implementation, then run `pnpm dogfood:docker-self`
against the current tree and attach the live OpenAPI/security evidence to work
`work_mrlaz41o2` before requesting review.

## Referenced by

[[ADR-0017-openapi-contract-artifact]] · [[openapi-module]] ·
[[openapi-module.test]] · [[openapi-route]] · [[openapi-route.test]] ·
[[grammar/typescript]]
