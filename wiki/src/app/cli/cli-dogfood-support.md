---
type: module
path: '@root/src/app/cli/cli-dogfood-support.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.66
depth_status: DEEP
tags: [module, deep, test-support]
aliases: [cli-dogfood-support]
---

# CLI Dogfood Support

## Purpose

Hide live-socket boot, real CLI parse/send mechanics, agent fixtures, contention
classification, and [[Grill]] round orchestration behind a compact harness so the
multi-agent lifecycle test remains readable and below the file-size gate.

## Interface

Exports `CliOutcome`, `Agent`, `RaceResult`, permission/event fixtures,
`runCli`, `expectOk`, `onLiveServer`, `driveGrillRound`, `initAgent`,
`classifyRace`, and `must`.

## Algorithm

`runCli` parses user argv through [[cli-commands]], sends through [[cli-client]],
and decodes JSON. `onLiveServer` scopes [[http-app]] to an ephemeral port.
`driveGrillRound` creates a [[ReviewComment]], opens/answers/verdicts a [[Grill]],
optionally resolves the comment, then evaluates. Race helpers classify expected
claim/lease conflict codes and reject every unexpected outcome.

The canonical permission fixtures preserve the review-role split from
[[ADR-0013-review-collaboration-permission]]: workers carry `review:respond` for
grill answers, while reviewers carry `review:collaborate` for comment and grill
construction/adjudication without inheriting `workspace:write`.

## Negative Logic

- ❌ Do NOT bypass the real parser/client path with synthetic HTTP calls.
- ❌ Do NOT treat malformed test argv or unexpected race results as protocol data.
- ❌ Do NOT expose bearer tokens in logs.
- ❌ Do NOT collapse worker response and reviewer collaboration into one test
  session.

## Depth

DEEP (0.66). One harness hides live Layer composition and repeated multi-agent
command ceremony across the complete lifecycle scenario.

## Grill Log

- **Q:** Why may malformed argv throw? **A:** The harness owns deterministic test
  input; parser failure is a test-author bug, not an ACP protocol outcome.
- **Q:** Why resolve comments before a passing grill evaluation? **A:**
  [[grill-service]] returns `incomplete` while any comment is open; the harness
  must preserve that production invariant.

## Referenced by

[[cli-dogfood-multi-agent.test]] · [[cli/_MOC]]
