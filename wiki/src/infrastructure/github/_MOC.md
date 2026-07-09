---
type: moc
tags: [moc, src, infrastructure, github]
---

# GitHub MOC

The [[GitHub]] seam — ACP's first external-process edge. Composed only into the
[[gh-bridge|gh bridge]] CLI runner, never into the domain core or main server layer.

- [[github-gateway]] — `GitHubGateway` `Context.Tag` + `GitHubGatewayApi`.
- [[github-gateway-gh]] — production adapter shelling out to the `gh` CLI.
- [[github-gateway-fake]] — in-memory scripted test double.

Value shapes + `parsePrRef` live in `github-types.ts`; `GitHubError` in
`github-error.ts`. The pure-core invariant is guarded by
`pure-core-invariant.test.ts`.

## Referenced by

[[infrastructure/_MOC]]
