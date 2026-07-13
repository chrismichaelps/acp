---
type: moc
tags: [moc, src, protocol, schema]
---

# Protocol Schema Source MOC

Mirror of `@root/src/protocol/schema/`; individual module pages define ids,
common vocabulary, entities, payloads, events, resume packets, grills, and review
comments.

- [[schema-index]] — opaque public schema barrel.
- [[common]] — shared closed vocabularies, including the additive
  `review:collaborate` / `review:respond` session permissions governed by
  [[ADR-0013-review-collaboration-permission]].
- [[session.schema]] — persisted session shape plus the shared permission-array
  mutual-exclusion refinement.
- [[schema.test]] — aggregate public decoding and rejection laws, including
  individual additive permission acceptance, dual-scope rejection, and unknown-
  literal rejection.
- [[grill.schema]] · [[grill.schema.test]] — forced review gate wire contract.
- [[review-comment.schema]] · [[review-comment.schema.test]] — diff comment and provenance wire contract.

## Referenced by

[[protocol/_MOC]] · [[src/_MOC]]
