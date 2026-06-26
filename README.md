# ACP

ACP is a vendor-neutral coordination protocol for software workers operating in
shared repositories and workspaces. It defines the state model for work,
workers, leases, artifacts, checkpoints, reviews, and append-only events.

ACP is not a chat protocol, an editor protocol, a model protocol, or a workflow
engine. It is the coordination layer beneath those systems: the place where
workers and hosts agree on what is claimed, what changed, what is blocked, what
was produced, and what can be resumed.

The reference implementation is TypeScript on Effect. The protocol specification
is still a draft, and older text in `specs.md` uses the historical name Hadoof.
The canonical project name in this repository is ACP.

## Implementation Status

The current implementation covers the protocol foundation. Effect Schema defines
the wire and domain objects. Tagged errors map to stable protocol error
envelopes. Runtime configuration is typed through Effect Config. Storage is a
seam with an in-memory adapter today and SQLite planned. EventStore persists
events and fans them out live through PubSub. WorkUnitService owns the first
domain lifecycle and state machine. Transport has an Effect Platform HTTP API
contract, a JSON protocol error mapper, and an SSE adapter for live event
streams.

The server entrypoint, HTTP handlers, CLI client, SQLite adapter, and the
remaining domain services are still ahead. The next implementation slice is
server and CLI wiring.

## Design

ACP is state-first. Workers coordinate by publishing durable state changes rather
than exchanging informal messages. A worker should be able to inspect a
workspace, understand the current state, and resume useful work without relying
on conversational history.

The core object model is intentionally small. A Worker performs or supervises
work. A Workspace is the environment where work happens. A WorkUnit is the unit
being advanced. A Lease is a temporary claim over a resource. An Artifact is a
durable output. A Checkpoint is resumable progress. A Review is an approval or
feedback step. An Event is the immutable audit record that gives the system its
timeline.

The current layer shape is:

```text
ConfigLayer
  ├── StorageLayer
  │     └── EventStoreLayer
  ├── WorkUnitService
  └── Transport
        ├── HttpApi contract
        ├── HTTP error mapper
        └── SSE event stream adapter
```

The important seams are Storage, Transport, and EventStream. Storage hides the
persistence decision. Transport keeps HTTP, SSE, and future JSON-RPC adapters out
of domain services. EventStream owns live delivery formatting while EventStore
owns ordering, persistence, and workspace filtering.

## Repository

This repository is governed through the wiki in `wiki/`. Source files under
`src/` have mirror pages under `wiki/src/`, and those pages are design authority.
When code changes, the corresponding wiki page and any affected seam, domain, or
architecture pages must change with it.

```text
src/
  config/                 typed runtime configuration
  protocol/
    schema/               protocol schemas and payloads
    errors/               tagged errors and protocol mapping
  domain/
    events/               persisted event log and live fan-out
    work-units/           WorkUnit state machine service
  infrastructure/
    storage/              Storage seam and in-memory adapter
    http/                 Effect Platform HTTP API contract
    sse/                  Server-Sent Events adapter

wiki/
  00-INDEX.md             vault entry point
  architecture/           topology, depth, build order
  domain/                 glossary and protocol concepts
  seams/                  boundary registry
  src/                    1:1 mirror of source modules
```

`specs.md` is the protocol draft. `SKILL.md` is the FMCF governance contract for
this codebase. The short version is simple: read the wiki first, project code
from the wiki, and keep both synchronized in the same change.

## Development

Use Node.js 24 and pnpm 11.7. Corepack is the expected way to get the right pnpm
version.

```bash
corepack enable
pnpm install
```

The standard validation gate is:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

If pnpm is not available in the shell, use the local project binaries directly:

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/prettier --check .
```

Work should land through focused branches such as `feat/http-server`,
`fix/state-transition`, or `docs/readme`. Commits should be semantic and scoped.
Pull requests should include validation results and call out any review-size
exception. Source changes require the matching wiki mirror updates.

## License

Apache-2.0. See `LICENSE`.
