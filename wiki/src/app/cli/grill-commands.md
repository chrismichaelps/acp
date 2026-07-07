---
type: module
path: '@root/src/app/cli/grill-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.58
depth_status: MEDIUM
tags: [module, medium, review-gate]
aliases: [cli-grill-commands]
---

# CLI Grill Commands

## Purpose

Own the `grill` CLI command map consumed by [[cli-commands]]. The forced
senior-question gate (open → ask → answer → verdict → evaluate, plus get/list) is
a review-gate workflow, so its parser rules live outside the central `parseArgs`
dispatcher and alongside [[cli-review-comment-commands]].

## Interface

```typescript
export const grillCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`grill open --review --work --workspace` maps to `POST
/v1/reviews/:review_id/grill`. `grill ask <grill_id> --severity --prompt` maps to
`POST /v1/grills/:grill_id/questions`. `grill answer <question_id> --answer`,
`grill verdict <question_id> --accept|--reject`, `grill evaluate <grill_id>`,
`grill get <grill_id>`, and `grill list --review <id>` map to their respective
question, gate, and read routes.

## Algorithm

Open sends the `OpenGrillPayload` (`review_id`/`work_id`/`workspace_id`); the
server derives `opened_by` from the session actor, so no `--by` flag is required.
Ask/answer take a positional id plus body flags. Verdict resolves exactly one of
`--accept`/`--reject` into an `accepted`/`rejected` body through a small guard
that fails when both or neither are present. Evaluate/get/list are bodyless id-
or `--review`-scoped requests.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT send `opened_by` on open — the server derives the opener from auth.
- ❌ Do NOT accept both or neither of `--accept`/`--reject` for a verdict.
- ❌ Do NOT decide the gate outcome here; `grill evaluate` only requests it.

## Depth

MEDIUM (0.58). Isolates grill-gate parser rules and extends the CLI
feature-registry split for the central parser.

## Referenced by

[[cli-commands]] · [[grill-routes]] · [[cli-usage]] · [[cli/_MOC]]
