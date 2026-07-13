---
type: decision
status: ACCEPTED
date: 2026-07-13
tags: [adr, accepted, auth, review, security]
aliases: [ADR-0013, review-collaboration-permission]
---

# ADR-0013 — Isolate Review Collaboration and Response Permissions

## Status

ACCEPTED and implemented after security grill revision. This decision governs
the additive `review:collaborate` and `review:respond` vertical security slice.
The wiki and canonical agent bootstrap were finalized before source changes;
the implementation and Docker evidence now conform to this contract.

## Context

The complete review gate has nine mutations that currently require
`workspace:write`. Eight adjudicate or maintain reviewer evidence; one records
the worker's answer:

| Family  | Mutation        | Permission           | Authoritative workspace target         |
| ------- | --------------- | -------------------- | -------------------------------------- |
| Comment | add             | `review:collaborate` | route review → work → workspace        |
| Comment | resolve         | `review:collaborate` | persisted comment → workspace          |
| Comment | reopen          | `review:collaborate` | persisted comment → workspace          |
| Comment | set external id | `review:collaborate` | persisted comment → workspace          |
| Grill   | open            | `review:collaborate` | route review → work → workspace        |
| Grill   | ask             | `review:collaborate` | persisted grill → workspace            |
| Grill   | answer          | `review:respond`     | persisted question → grill → workspace |
| Grill   | verdict         | `review:collaborate` | persisted question → grill → workspace |
| Grill   | evaluate        | `review:collaborate` | persisted grill → workspace            |

`workspace:write` also authorizes workspace creation, update, and archive. A
first design replaced it with one `review:collaborate` permission, but granting
that permission to a worker session for `grill answer` also let that same session
accept and evaluate its blocker. A production review gate requires the host to
reject that single-session overgrant; lacking `review:approve` alone is not
sufficient.

Create-comment and open-grill also currently authorize the request body's
`workspace_id`. Their route target is a review, so client-supplied tenant
metadata cannot be the authorization authority. Finally, ordinary load-then-
authorize behavior returns 404 for a missing id and 403 for an existing foreign
id, exposing resource existence across tenants.

## Decision

### Permission vocabulary and role separation

Add two literals to the closed session vocabulary:

- `review:collaborate` authorizes the eight reviewer-evidence/adjudication
  mutations in the table.
- `review:respond` authorizes only `grill answer`.

Both are additive wire vocabulary changes. No existing permission is renamed or
removed. They are not aliases for each other or for `workspace:write`.
Read-only comment/grill routes continue to require `workspace:read`; review
outcome commands retain their existing `review:*` scopes.

The canonical worker token carries `review:respond` and does not carry
`review:collaborate`. It can answer a blocker but receives `403 forbidden` on
comment add/resolve/reopen/external-id and grill open/ask/verdict/evaluate. The
canonical reviewer token carries `review:collaborate` and not `review:respond`;
it can construct and adjudicate the gate but cannot answer with that token.

Session initialization rejects a permission array containing both
`review:respond` and `review:collaborate` before a session id is minted. The
shared initialization schema owns this mutual-exclusion refinement, so REST,
native Effect RPC, JSON-RPC HTTP/WebSocket, and stdio enforce the same rule. A
request with both literals returns the existing 400 `invalid_request` validation
envelope with this issue:

```text
review:respond and review:collaborate are mutually exclusive
```

This is a per-session least-privilege invariant, not proof of independent human
or agent identity. The v0.1 `session.initialize` route is an open, caller-scoped
bootstrap: a trusted local operator/client may mint the documented role tokens,
but a malicious client can select multiple worker ids and mint separate tokens.
Trusted hosted issuance and stable external identity are explicitly deferred to
[[ADR-0015-trusted-session-issuance]].

### Scope-first, target-derived, non-enumerating authorization

Every collaboration/response mutation follows this order:

1. Resolve the bearer session and require the action permission before loading
   an opaque target id. Missing scope returns `403` for every supplied id.
2. Load the route/persisted target and its owning workspace. A missing target
   returns `404 not_found`.
3. Check the session's workspace binding. An existing target outside that
   binding is deliberately mapped to the same `NotFoundError(entity, id)` as a
   missing target, producing the identical 404 envelope.
4. Only after scope and binding succeed may the handler validate request identity
   fields and call the mutation service.

For add-comment and open-grill, the path review is authoritative. Load that
review and its work, then compare body `review_id`, `work_id`, and `workspace_id`
with the persisted target. Report all mismatches in deterministic field order;
do not authorize the body first and do not silently rewrite it. Comment/grill/
question id routes derive workspace only from persisted state.

This specializes [[ADR-0009-workspace-scoped-sessions]] for opaque resource ids:
explicit workspace-target authorization still uses ordinary 403 binding denial,
while missing and foreign opaque collaboration targets are non-enumerating 404s.

### Exact HTTP error contract

The slice reuses existing `ForbiddenError`, `NotFoundError`, and
`ValidationError`; the HTTP mapper does not change.

| Case                                        | Status | Required protocol error                                                                                                                     |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| No/invalid bearer                           | 401    | `unauthorized` (existing behavior)                                                                                                          |
| Any supplied id, session lacks action scope | 403    | `forbidden`; message `session lacks scope: review:collaborate` or `session lacks scope: review:respond`; `details` is encoded `Option.None` |
| Requested id absent                         | 404    | `not_found`; message `<entity> <id> not found.`; `details` is encoded `Option.Some({entity,id})`                                            |
| Requested id exists outside binding         | 404    | byte-for-byte the same body as the absent-id row for that entity/id                                                                         |
| In-scope add/open identity mismatch         | 400    | `invalid_request`; message `Request failed validation.`; `details.value.issues` contains the deterministic mismatch strings below           |

Mismatch issues, emitted only for fields that disagree and in this order:

```text
review_id must match the target review
work_id must match the target review work
workspace_id must match the target review workspace
```

The current JSON HTTP renderer serializes `details` as Effect `Option`; tests
must assert the existing encoded form rather than invent a second envelope.

Representative exact bodies (substitute the requested entity/id and required
scope; missing and foreign use the same 404 body):

```json
{
  "error": {
    "code": "forbidden",
    "message": "session lacks scope: review:collaborate",
    "details": { "_id": "Option", "_tag": "None" }
  }
}
```

```json
{
  "error": {
    "code": "not_found",
    "message": "grill grill_123 not found.",
    "details": {
      "_id": "Option",
      "_tag": "Some",
      "value": { "entity": "grill", "id": "grill_123" }
    }
  }
}
```

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Request failed validation.",
    "details": {
      "_id": "Option",
      "_tag": "Some",
      "value": {
        "issues": [
          "review_id must match the target review",
          "work_id must match the target review work",
          "workspace_id must match the target review workspace"
        ]
      }
    }
  }
}
```

### Canonical sessions

The reviewer retains nine permissions, replacing `workspace:write` with
`review:collaborate`:

```text
workspace:read,review:collaborate,event:read,memory:create,memory:read,
review:approve,review:reject,review:request_changes,review:cancel
```

The worker lifecycle union adds `review:respond` solely for `grill answer`. It
does not include `review:collaborate`, `workspace:write`, or review verdict
permissions. Both sessions remain bound to their target workspace.

### Migration behavior

Migration is fail closed. A session minted before upgrade with
`workspace:write` but without the new action permission remains a valid session,
yet all nine mutations return `403 forbidden`. Operators must reinitialize the
worker with `review:respond` and reviewer with `review:collaborate`. The host must
not infer, alias, or silently translate old permissions.

### Transport boundary and stdio proof

REST is the implementation surface for all nine mutations. The CLI exposes the
agent comment/grill commands; the GitHub bridge uses the external-id REST
mutation. Native Effect RPC and JSON-RPC HTTP/WebSocket do not currently define
comment or grill commands; this slice does not invent dead endpoints. Their
obligation is session compatibility: `session.initialize` accepts either new
permission literal, rejects the pair, and preserves the accepted permission
array through the shared codec. The native handler in [[acp-rpc-handlers]] has
an independent success projection and must return `permissions` explicitly;
schema reuse alone does not satisfy response parity.

The Docker auth probe owns executable stdio evidence. It runs:

```text
docker exec -i <auth-container> node dist/app/stdio/main.js
```

The probe writes one UTF-8 byte-counted `Content-Length` frame containing a
JSON-RPC `session.initialize` request with `review:collaborate` and the allowed
workspace, closes stdin, decodes the returned frame, and asserts the matching
JSON-RPC id, `result.permissions`, `result.workspace_ids`, and `session_id`. A
second framed request containing both review scopes must return the exact
invalid-request issue and no session id. The probe then passes the valid
`session_id` to the container CLI REST client for one allowed collaboration
mutation and a denied workspace-administration mutation. The governing runtime
mirror is [[stdio-main]].

## Rationale

Response and adjudication are different powers. Two narrow permissions plus
initialization-time mutual exclusion prevent one accidentally overbroad session
from performing both actions. Scope-first authorization prevents resource
probing by callers that lack the action, while collapsing missing and foreign
opaque targets to one 404 prevents cross-tenant enumeration by authorized
collaborators. Additive vocabulary plus fail-closed rotation avoids implicit
privilege inheritance. Protection from a malicious client minting multiple
identities or tokens requires the trusted issuer proposed by ADR-0015.

## Consequences

- A respond-only session can answer but cannot set verdicts, evaluate, or
  construct review evidence.
- A collaborate-only session can construct/adjudicate evidence but cannot answer.
- No single initialized session may carry both scopes.
- Reviewer and worker tokens carry no workspace-administration permission.
- Existing `workspace:write`-only sessions must be rotated at deployment.
- The focused [[review-collaboration-auth]] module owns scope-first actor
  resolution and binding-only denial → `NotFoundError`; the existing
  [[resource-workspace-auth]] module and global mapper stay unchanged.
- Workspace provisioning remains governed separately by
  [[ADR-0014-workspace-administration-authority]].
- Trusted external identity and server-policy-derived hosted sessions remain the
  separate [[ADR-0015-trusted-session-issuance]] backlog.

## Validation

Implementation is complete only when tests prove:

1. REST, native RPC, JSON-RPC HTTP, JSON-RPC WebSocket, and Content-Length stdio
   session initialization accept and preserve either permission literal, reject
   the pair with the exact mutual-exclusion issue, and mint no rejected session.
   The native handler response independently echoes the accepted array.
2. A respond-only worker succeeds on `grill answer` and receives `403` on all
   eight collaboration mutations, especially verdict and evaluate.
3. A collaborate-only reviewer succeeds on all eight collaboration mutations
   and receives `403` on `grill answer`.
4. Correctly scoped sessions succeed only inside their workspace. For every
   opaque target family, missing and foreign ids return identical 404 envelopes;
   an in-scope target with missing action scope returns the exact 403 envelope.
5. Add-comment/open-grill mismatches return the exact 400 envelope and ordered
   issue strings without persisting state.
6. `workspace:write` without either new permission is denied on all nine
   mutations.
7. A collaborator/respondent without `workspace:write` is denied workspace
   create, update, and archive.
8. Read routes and review outcome scopes retain existing behavior.
9. Docker ACP self-dogfood uses reinitialized worker/reviewer tokens, runs the
   complete gate, the stdio proof, and every positive/negative boundary above.
10. Documentation states that open self-scoped bootstrap trusts the issuer and
    does not claim hostile-client identity separation before ADR-0015 lands.

## Grill Log

- **Q:** Can one collaboration scope safely serve worker answer and reviewer
  verdict/evaluate? **A:** No; split `review:respond` from
  `review:collaborate`. _Rationale:_ a worker must not make its own blocker pass.
  _Rejected:_ relying on absence of `review:approve`, actor conventions, or
  documentation of the overgrant.
- **Q:** Does same-worker answer/adjudication need a cross-session domain ban in
  this slice? **A:** No. Reject both scopes in one session, but do not add a rule
  keyed by caller-selected worker id; an open bootstrap client can choose a new
  id, making that rule bypassable security theater. _Rationale:_ production-safe
  cross-session separation requires verified identity and server-side role
  assignment from [[ADR-0015-trusted-session-issuance]]. _Rejected:_ claiming
  hostile-client independence from canonical role examples.
- **Q:** Why `review:respond` rather than `grill:answer`? **A:** Use the existing
  review permission namespace for a worker response within the review gate.
  _Rationale:_ it remains a single-purpose action while fitting the protocol's
  review authorization family. _Rejected:_ a new top-level grill namespace for
  one action and a vague `review:write` token.
- **Q:** Can create routes trust a branded body workspace? **A:** No; load the
  path review and derive its work/workspace. _Rejected:_ body-first authorization
  and silent identity rewriting.
- **Q:** Should a foreign existing target return 403? **A:** No; return the same
  `NotFoundError` envelope as a missing target after scope passes. _Rationale:_
  403 versus 404 is a resource-existence oracle. _Rejected:_ redacting only the
  403 message while retaining different status codes.
- **Q:** Does non-enumeration require a new protocol error? **A:** No; reuse
  `NotFoundError` for binding-only denial and `ValidationError` for in-scope
  identity mismatch. _Rejected:_ changing the global mapper in this slice.
- **Q:** Must native RPC/JSON-RPC gain nine commands? **A:** No; propagate the
  individually accepted permission literals and dual-scope rejection through
  existing session codecs only. _Rejected:_ dead handlers added to claim parity.
- **Q:** What proves stdio rather than inference from `/rpc`? **A:** Spawn
  `dist/app/stdio/main.js`, exchange a real Content-Length frame, assert the
  returned scoped session, reject the dual-scope frame, then use the valid token
  on REST. _Rejected:_ frame-codec unit tests or JSON-RPC HTTP tests alone.
- **Q:** Should workspace administration be solved here? **A:** No; keep
  [[ADR-0014-workspace-administration-authority]] independent. _Rejected:_
  delaying the review boundary until provisioning policy is chosen.

## Referenced by

[[agent-integration]] · [[common]] · [[review-comment-routes]] ·
[[grill-routes]] · [[review-collaboration-auth]] ·
[[resource-workspace-auth]] · [[stdio-main]] · [[acp-rpc-handlers]] ·
[[acp-http-api]] · [[router]] ·
[[ADR-0009-workspace-scoped-sessions]] · [[decisions/_MOC]] ·
[[ADR-0015-trusted-session-issuance]] ·
[[architecture/_MOC]] · [[CHANGELOG]] ·
[[2026-07-13-review-collaboration-security-design]]
