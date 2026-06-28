---
type: architecture
tags: [architecture]
aliases: [LANGUAGE, vocabulary]
---

# Architecture Language (canonical vocabulary)

Grounded in Ousterhout, _A Philosophy of Software Design_. This page prevents
linguistic drift between human and agent. Every architectural term used in the
vault must be defined here first.

- **Module** — any unit with an interface and an implementation (function, class,
  service, tier-slice). Scale-agnostic. The unit of a wiki page.
  _Not:_ a file. A file may hold one module; large files are split per the Split Protocol.
- **Interface** — everything a caller must know to use a module correctly: types,
  invariants, error modes, ordering, side effects. _Not:_ just the type signature.
- **Implementation** — the body fulfilling the interface's promises, hidden from callers.
- **Depth** — ratio of behavior exercised to interface learned. A quality measure,
  not a size measure. _Deep_ = thin surface hiding much; _Shallow_ = surface ≈ implementation.
- **Seam** — a boundary with at least one swappable adapter behind a stable interface.
  Classified BACKBONE / CRITICAL / EXPLORATORY / INTERNAL by capacity.
  _Not:_ every interface — an INTERNAL boundary inside one subsystem is not a seam.
- **Adapter** — a concrete implementation behind a seam interface (`production` or `test`).
- **Locality** — fraction of a module's callers that live inside its own subsystem.
- **Deepening** — refactoring that increases a module's Depth (hide more behind less).
- **Subsystem (bounded context)** — a cluster of modules with intentional internal
  coupling; seam rules do not apply within it.

## ACP-specific terms

- **Worker** — any actor performing or supervising work (agent / human / bot / ci / system).
- **Workspace** — a logical environment where work happens (repo, worktree, sandbox, …).
- **Work Unit** — a unit of work with a lifecycle state machine.
- **Lease** — a temporary, expiring claim over a resource (file, branch, task, …).
- **Artifact** — a durable output of work (patch, PR, report, log, …).
- **Checkpoint** — a resumable summary of partial progress.
- **Review** — an explicit approval / rejection / changes-requested step.
- **Event** — an immutable, append-only record of something that happened.
- **Host** — the application owning workspace state and serving the protocol.

## Referenced by

(maintained by Forensic Guardian)
