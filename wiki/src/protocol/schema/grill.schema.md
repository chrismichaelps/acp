---
type: module
path: '@root/src/protocol/schema/grill.schema.ts'
fidelity: Active
domain: '[[Grill]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium, review, gate]
aliases: [grill.schema, Grill, GrillQuestion, GrillEvaluation]
---

# Grill Schema

## Purpose

Wire + domain shape of [[Grill]], a forced senior-question review gate imposed on high-risk work.
Captures review gate lifecycle: gate opening, questions posed by reviewers, answers/verdicts on each
question, and final evaluation outcome (spec §15).

## Interface

### Signatures

```typescript
export const Grill: Schema.Struct<{
  id: GrillId
  review_id: ReviewId
  work_id: WorkId
  workspace_id: WorkspaceId
  opened_by: WorkerId
  state: GrillState
  created_at: Timestamp
  closed_at: Option<Timestamp>
}>

export const GrillQuestion: Schema.Struct<{
  id: GrillQuestionId
  grill_id: GrillId
  prompt: NonEmptyString
  severity: QuestionSeverity
  answer: Option<string>
  answered_by: Option<WorkerId>
  verdict: QuestionVerdict
  created_at: Timestamp
  answered_at: Option<Timestamp>
  decided_at: Option<Timestamp>
}>

export const OpenGrillPayload: Schema.Struct<{
  review_id: ReviewId
  work_id: WorkId
  workspace_id: WorkspaceId
}>

export const AddGrillQuestionPayload: Schema.Struct<{
  prompt: NonEmptyString
  severity: QuestionSeverity
}>

export const GrillEvaluation: Schema.Struct<{
  grill: Grill
  outcome: 'pass' | 'fail' | 'incomplete'
  blocking: string[]
}>

export type Grill = typeof Grill.Type
export type GrillQuestion = typeof GrillQuestion.Type
export type OpenGrillPayload = typeof OpenGrillPayload.Type
export type AddGrillQuestionPayload = typeof AddGrillQuestionPayload.Type
export type GrillEvaluation = typeof GrillEvaluation.Type
```

## Algorithm

Struct over [[ids]] + [[common]]. `Grill` represents the gate instance, opened on a review/work pair;
state transitions: `open` → `passed` (all blockers accepted) or `failed` (≥1 rejected).
`GrillQuestion` captures each reviewer's blocker/major/minor question; answered by the author,
then decided (accepted/rejected) by the reviewer. `verdict` is independent of answer: a good answer
can still be rejected if it doesn't resolve the question.

## Grill Log

- Grill gate enforces async decision loop: question → answer → verdict, per question independently.
- `severity` (blocker/major/minor) drives blocking-set computation in `GrillEvaluation`.
- `closed_at` is `None` until final `GrillEvaluation` computes outcome and closes the gate.
- `blocking` array in evaluation lists all blocker questions that are unresolved (verdict != accepted).

## Referenced by

[[review.schema]] · [[grill.schema.test]] · [[schema/_MOC]] · [[src/_MOC]]
