---
type: reference
tags: [reference, spec]
aliases: [spec-canonicalization, naming-canonicalization]
---

# Spec Canonicalization Note

The local `@root/specs.md` file is a working draft. It now uses **Agent
Coordination Protocol (ACP)** as the canonical protocol name in normative
sections and keeps Hadoof/AWP only in the historical supersession note. The
reference implementation still treats the wiki plus code as tracked project
truth, but the draft is now readable without translating old product names or
nonexistent repository examples.

The tracked source of truth is the wiki plus code. [[ADR-0001-architecture-foundation]]
settles the project name as ACP, the environment prefix as `ACP_`, the artifact
URI scheme as `acp://`, and the package/runtime vocabulary as ACP. README, source
modules, transport routes, and wiki mirrors follow that decision. Any remaining
Hadoof mention in `specs.md` should therefore be read only as historical draft
context, not active implementation vocabulary.

When implementing future spec slices, do not introduce new Hadoof identifiers,
filenames, environment variables, route names, package names, or documentation
aliases. If a future tracked spec mirror is created, it should preserve protocol
semantics and ACP naming before review.

This note does not rewrite protocol behavior. It only fixes the interpretation
rule for an ignored draft whose own ending section already declares ACP as the
final name. Semantic changes still require their own ADR, wiki mirror update, and
tests or validation gate.

## Referenced by

[[00-INDEX]] · [[protocol-coverage-2026-06-27]] ·
[[ADR-0001-architecture-foundation]]
