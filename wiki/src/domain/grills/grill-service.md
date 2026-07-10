---
type: module
path: '@root/src/domain/grills/grill-service.ts'
fidelity: Active
domain: '[[Grill]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, deep]
aliases: [grill-service, GrillService]
---

# Grill Service

## Purpose

Own the forced senior-review gate for a [[Work]] unit. A [[Grill]] collects
blocker/nit [[GrillQuestion]] items a senior reviewer asks about a [[Review]];
a worker answers them, the reviewer sets a verdict per question, and the grill
is finally `evaluate`d into a pass/fail/incomplete gate outcome. The service
persists grills and questions through [[Storage]] (two collections, `grill`
and `grill_question`, keyed by indexed `review_id` / `grill_id`), performs
version-CAS writes on question mutation via `getVersioned` + `replaceIfVersion`
(the Feature 580 API), and emits `grill.opened`, `grill.question_added`,
`grill.answered`, `grill.verdict_set`, `grill.passed`, and `grill.failed`
[[Event]] records through [[EventStore]].

## Interface

```typescript
export interface GrillServiceApi {
  readonly open: (
    input: OpenGrillInput,
  ) => Effect<Grill, InvalidStateTransitionError | StorageError>
  readonly addQuestion: (
    grillId: GrillId,
    input: AddGrillQuestionInput,
  ) => Effect<
    GrillQuestion,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
  readonly answer: (
    questionId: GrillQuestionId,
    input: AnswerGrillQuestionInput,
  ) => Effect<GrillQuestion, NotFoundError | StorageError>
  readonly setVerdict: (
    questionId: GrillQuestionId,
    verdict: 'accepted' | 'rejected',
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<GrillQuestion, NotFoundError | StorageError>
  readonly get: (
    grillId: GrillId,
  ) => Effect<
    Option<{ grill: Grill; questions: readonly GrillQuestion[] }>,
    StorageError
  >
  readonly getQuestion: (
    questionId: GrillQuestionId,
  ) => Effect<Option<GrillQuestion>, StorageError>
  readonly listForReview: (
    reviewId: ReviewId,
  ) => Effect<readonly Grill[], StorageError>
  readonly evaluate: (
    grillId: GrillId,
    now: Timestamp,
  ) => Effect<GrillEvaluation, NotFoundError | StorageError>
}
```

## Governance

- At most one `open` grill may exist per [[Review]]; `open` rejects a second
  with `InvalidStateTransitionError`.
- Questions may only be added while the grill is `open`.
- The caller supplies every id and `Timestamp` (deterministic, matching
  existing domain-service convention).
- Question mutation (`answer`, `setVerdict`) is a single version-CAS write;
  a lost race fails with `StorageError` op `grill_question_conflict` rather
  than silently overwriting.
- `evaluate` is the only path that transitions a grill to `passed`/`failed`,
  and it stamps `closed_at = now`.
- Every state change persists before the corresponding event is emitted.

## Algorithm

1. `open` scans `listForReview`; if any existing grill is `open` it fails,
   otherwise it saves a new `open` grill and emits `grill.opened`.
2. `addQuestion` requires the grill exists and is `open`, saves a `pending`
   question carrying its `grill_id`, and emits `grill.question_added`.
3. `answer` CAS-updates the question with the answer + answerer + `answered_at`
   and emits `grill.answered`.
4. `setVerdict` CAS-updates the question verdict (`accepted`/`rejected`) with
   `decided_at` and emits `grill.verdict_set`.
5. `get` composes the grill with its questions (queried by indexed `grill_id`).
6. `evaluate` (spec A.2 gate rule) loads the grill + questions + the review's
   [[ReviewComment]]s, then partitions the blocker questions:
   - any blocker `rejected` → **fail**: close to `failed`, emit `grill.failed`.
   - else any blocker `pending` OR any comment still `open` → **incomplete**:
     no state change, return the blocking reasons.
   - else → **pass**: close to `passed`, emit `grill.passed`.
     The returned `GrillEvaluation.blocking` lists free-text reasons (rejected
     blockers, unanswered blockers, unresolved comment files).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT open a second grill on a review that already has an open one.
- ❌ Do NOT add questions to a non-open grill.
- ❌ Do NOT write a question without version-CAS (no blind `put` on mutate).
- ❌ Do NOT transition a grill to passed/failed anywhere but `evaluate`.
- ❌ Do NOT return `pass` while any blocker is pending/rejected or any comment
  is open.
- ❌ Do NOT emit grill events before storage succeeds.

## Depth

DEEP (0.72). The service hides two-collection storage layout, indexed query
filtering, schema encode/decode, version-CAS conflict handling, event
emission, and the multi-source gate rule behind one domain surface. Its only
seams are [[Storage]], [[EventStore]], and [[ReviewCommentService]].

## Grill Log

- **Q:** Why does `evaluate` distinguish `incomplete` from `fail`?
  **A:** A pending blocker or an open comment is not yet a rejection — the
  worker can still answer or the reviewer can still resolve. Returning
  `incomplete` with no state change keeps the grill re-evaluable, while `fail`
  (a rejected blocker) is a terminal reviewer decision.

- **Q:** Why version-CAS on question mutation but plain `put` on the grill?
  **A:** Questions are the contended surface — worker answers and reviewer
  verdicts race concurrently, so a lost update would drop an answer or a
  verdict. Grill lifecycle transitions (`open`, `evaluate`) are single-writer
  by protocol, so a plain write is safe.

## Referenced by

[[grill-index]] · [[grills/_MOC]] · [[Grill]] · [[ReviewComment]] · [[src/_MOC]]
