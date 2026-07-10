---
type: moc
tags: [moc, src, infrastructure, github]
---

# GitHub MOC

The [[GitHub]] seam — ACP's first external-process `EXPLORATORY` boundary.
Composed only into the [[gh-bridge|gh bridge]] CLI runner, never into the domain
core or main server layer.

- [[github-error]] — typed `gh` command failure.
- [[github-types]] — PR/comment value shapes and PR-reference parser.
- [[github-gateway]] — `GitHubGateway` `Context.Tag` + `GitHubGatewayApi`.
- [[github-gateway-gh]] — production adapter shelling out to the `gh` CLI.
- [[github-review-thread]] — paginated REST-comment → GraphQL-thread resolver.
- [[github-gateway-fake]] — in-memory scripted test double.
- [[index|github-index]] — opaque infrastructure barrel.
- [[github-types.test]] — PR-reference parser regressions.
- [[github-gateway-fake.test]] — fake state-reflection regressions.
- [[github-gateway-gh.test]] — real-adapter argv/error regressions.
- [[github-gateway-gh-review-thread.test]] — lookup/mutation orchestration regressions.
- [[github-review-thread.test]] — thread lookup, pagination, and failure regressions.
- [[pure-core-invariant.test]] — edge-isolation architecture guard.

Every source file in `@root/src/infrastructure/github/` has a mirrored page here.

## Referenced by

[[infrastructure/_MOC]]
