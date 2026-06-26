---
type: domain
tags: [domain]
aliases: [Workspace, workspace]
---

# Workspace

- **Definition:** A logical environment where work happens. The unit of state
  ownership and access control; every [[WorkUnit]], [[Lease]], [[Artifact]],
  [[Checkpoint]], [[Review]], and [[Event]] belongs to exactly one workspace.
- **Canonical name:** Workspace. Never "repo" (a repo is one `kind` of workspace),
  never "project".
- **Not:** a [[Worker]] nor a Git branch (a branch may be a leased resource).
- **Kinds:** `git_repository · git_worktree · directory · container · cloud_sandbox · ci_job`.
- **Git-aware, not Git-dependent:** a workspace may map to Git but must not require it
  (Design Principle 4.4).
- **Example:** `workspace_123` "acme/web", kind git_repository, default branch main.

## Referenced by

(maintained by Forensic Guardian)
