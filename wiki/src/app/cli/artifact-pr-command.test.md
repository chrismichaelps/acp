---
type: module
path: '@root/src/app/cli/artifact-pr-command.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.42
depth_status: MEDIUM
tags: [module, medium, test]
aliases: [artifact-pr-command-test]
---

# Artifact PR Command Test

## Purpose

Pin the CLI parser behavior for registering GitHub pull request URLs as external
[[Artifact]] evidence. The test keeps the v0.2 GitHub PR artifact lane grounded
in the existing artifact create route instead of introducing GitHub-side effects
or provider credentials.

## Interface

```typescript
describe('artifact pr command', () => {
  it('records a pull request as an external artifact reference', ...)
  it('requires a pull request URL before sending the command', ...)
})
```

## Algorithm

The happy-path assertion parses `artifact pr --workspace --work --url
[--summary]` and expects a `POST /v1/artifacts` request whose body fixes
`kind: 'pull_request'`, copies `--url` into `uri`, and forwards the optional
summary. The validation assertion omits `--url` and expects the parser to return
`CliError` before any HTTP request can be built.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT test GitHub network behavior here; [[cli-commands]] is a pure parser.
- ❌ Do NOT treat `artifact pr` as a separate protocol object; it is a
  convenience command over the existing [[Artifact]] schema.

## Depth

MEDIUM (0.42). The test is narrow, but it protects a user-facing command shape
for a v0.2 integration lane while keeping the parser module's main regression
file under the source-size guard.

## Referenced by

[[cli/_MOC]] · [[cli-commands]]
