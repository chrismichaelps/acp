---
type: reference
tags: [reference, spec]
aliases: [spec-canonicalization, naming-canonicalization]
---

# Spec Canonicalization Note

The local `@root/specs.md` file is an ignored working draft. It still contains
older Hadoof-era language in the opening sections, examples, implementation
notes, and some URI samples, while its supersession section names **Agent
Coordination Protocol (ACP)** as the canonical protocol name. Because the file is
ignored, the reference implementation does not rely on direct edits to that draft
for tracked project truth.

The tracked source of truth is the wiki plus code. [[ADR-0001-architecture-foundation]]
settles the project name as ACP, the environment prefix as `ACP_`, the artifact
URI scheme as `acp://`, and the package/runtime vocabulary as ACP. README, source
modules, transport routes, and wiki mirrors follow that decision. Older Hadoof
mentions in `specs.md` should therefore be read as historical draft residue, not
as active implementation vocabulary.

When implementing future spec slices, translate draft names at the boundary:
`Hadoof` means `ACP`, `Hadoof Host` means ACP host, `Hadoof Client` means ACP
client, and `hadoof://` examples mean `acp://`. Do not introduce new Hadoof
identifiers, filenames, environment variables, route names, package names, or
documentation aliases. If a future tracked spec mirror is created, it should copy
the protocol semantics while normalizing those names before review.

This note does not rewrite protocol behavior. It only fixes the interpretation
rule for an ignored draft whose own ending section already declares ACP as the
final name. Semantic changes still require their own ADR, wiki mirror update, and
tests or validation gate.

## Referenced by

[[00-INDEX]] · [[protocol-coverage-2026-06-27]] ·
[[ADR-0001-architecture-foundation]]
