---
type: decision
status: ACCEPTED
date: 2026-08-04
tags: [adr, proposed, identity, provenance, workers, audit, signing]
aliases: [ADR-0024, worker-identity-provenance]
---

# ADR-0024 — Worker Identity and Provenance

## Status

ACCEPTED — implemented.

Delivered: the Ed25519 assertion core in `src/domain/identity/` — a canonical
signing payload, verification, and a bounded replay window — plus `public_key`,
`bom`, and `expires_at` on `Worker`, declarable at handshake. Both new worker
fields are optional, so unsigned workers stay first-class.

The canonical payload is JSON with a fixed field order rather than a
delimiter-joined string. Joining on a separator lets a crafted field shift the
boundaries, so a worker id of `agent_a|work.claim` could forge a claim about
another target; JSON escapes the delimiters, and a test asserts it. Verification
returns a reason rather than throwing, because malformed keys, signatures and
timestamps are untrusted network input and a crash is not an acceptable answer
to any of them.

Corrected: this ADR said expiry moves a worker to an `expired` status.
`WorkerStatus` is a closed literal union, so adding a member is a protocol break
for every consumer — the same reason ADR-0021 declined a new `EventType`. A
lapsed worker is `offline`, and `expires_at` in the past distinguishes a
registration that lapsed from one that shut down cleanly. No protocol change.

Enforcement now ships: `WorkerIdentityService`,
`ACP_REQUIRE_WORKER_SIGNATURES` (off by default), and verification on
`work.claim`, checked in the domain service so every transport inherits it and
after the session has already authorized the call.

Two rules the ADR did not settle, decided during implementation:

- **A failed proof is refused in both modes.** Enforcement governs whether proof
  is _required_, not whether a _failed_ proof is acceptable — accepting a
  signature that does not verify would make the recorded `signed` flag
  meaningless.
- **Verification reads the worker only when it needs the key.** An unsigned
  claim under unenforced mode returns without a lookup. An earlier version read
  the worker unconditionally, which silently made registration a precondition of
  every claim; 71 tests caught it.

Also delivered: `review.verdict` signing, verified in `transitionReview` so
every verdict funnels through one check rather than three call sites that could
drift apart; `ACP_WORKER_REGISTRATION_TTL`; and `WorkerService.expireLapsed`,
run by the background sweeper beside session eviction and lease expiry.

The registration lifecycle is now closed: the handshake stamps `expires_at`
from `ACP_WORKER_REGISTRATION_TTL`, so each connection acts as the heartbeat —
a worker that keeps connecting stays live, one that stops lapses and the
sweeper marks it `offline`.

`grill.answer` verification ships too, checked before the write so a refused
answer leaves no half-attributed trace.

**Provenance travels as a header**, `x-acp-assertion`, carrying base64url JSON.

A self-review before merge found that enforcement would have refused every
review verdict and grill answer outright: verification demanded proof, but no
verdict or grill transport could carry an assertion — reject, request-changes
and cancel have no request body at all — so no caller could ever supply one. A
config flag that bricks reviews when enabled is not shippable, documented or
not.

A header rather than a body field settles that: it adds no body to bodyless
endpoints, it is uniform across REST and native RPC instead of one mechanism
per protocol, and it matches what the value is — metadata about the request,
travelling beside the bearer token it accompanies. The duplicate
`ClaimWorkPayload.assertion` field was removed so there is exactly one way in.

Absence and malformation are deliberately different answers. An absent header
means no proof was offered, permitted unless signatures are enforced. A
present-but-unreadable header is a `400`: treating it as absence would let a
corrupted or tampered header silently downgrade to an unsigned request.

The same review found `review.cancel` routed through the shared verification
funnel while exposing no `assertion` parameter, making cancellation impossible
under enforcement. `cancel` now accepts one, so every path through
`transitionReview` can prove itself.

All four actions are now enforceable end-to-end.

Strengthened by [[ADR-0026-agent-sandbox-runtime]]: once the runtime launches
the agent process, the bill of materials stops being self-reported and becomes
host-observed — which closes the honesty gap this ADR's Grill Log flagged.

## Context

A `Worker` in ACP is a name, a kind, an optional vendor string, a status, and a
closed set of capabilities. Anything holding a valid session may register one and
claim to be anything: nothing binds the registration to the software that made
it, and nothing binds a later claim to the worker that registered.

That gap undermines the parts of ACP whose whole purpose is accountability. The
review and grill gates exist so a decision can be traced to whoever made it, and
`created_by` / `assigned_to` are only as trustworthy as the registration behind
them. When a work unit is approved, the log records _a worker id_ approved it —
not that the software holding that worker's key did.

There is a second, quieter gap: registrations are immortal. A worker has a
status but no expiry, so a crashed agent leaves a registration that looks alive
forever, and nothing distinguishes "idle" from "gone".

`codex-rs/agent-identity` from [`openai/codex`](https://github.com/openai/codex)
addresses the first: an Ed25519 keypair per agent, registration carrying the
public key plus capabilities and a TTL, and a signed assertion per task. It also
carries an **Agent Bill of Materials** — `agent_version`, `agent_harness_id`,
`running_location` — recording what software is acting, not merely which
identity.

## Decision

### Identity is provenance, not authorization

Sessions continue to authorize, exactly as
[[ADR-0015-trusted-session-issuance]] specifies. Worker identity answers a
different question: which software, at which version, actually produced this
claim.

Both are checked, neither replaces the other, and the ordering is explicit — a
request is authorized by its session first; signature verification then
establishes attribution. A valid signature never grants access, so a compromised
worker key cannot become an escalation path, and the existing auth surface needs
no changes.

### Keypair per worker; the host stores only public keys

A worker generates an Ed25519 keypair and submits the public key at
registration. The private key never leaves the worker and the host has no API
that accepts one. Ed25519 because signatures are small and verification is fast
enough to sit in a request path.

Key rotation is re-registration under a new worker id. Mutable key material on a
long-lived identity would mean past signatures verify against a key the worker
no longer holds, which defeats attribution.

### A Bill of Materials on every worker

Registration carries, and the `Worker` record stores:

```ts
bom: {
  worker_version: string // version of the agent software
  harness: string // what is running it — "acp-cli", "codex-cli", …
  location: string // where it runs — host/container/CI identifier
}
```

This is the idea worth importing most directly, because it is the field that
answers post-incident questions. "Worker `w-7` approved this" is not actionable;
"`acp-cli` 1.1.0 under CI runner 42 approved this" is. Capabilities describe what
a worker _claims it can do_; the BOM describes what is actually running.

The BOM is host-recorded at registration and immutable thereafter — a worker
cannot restate what it is mid-life without re-registering.

### Signing covers state-changing claims, not reads

Signed: registration, work claim, review verdict, grill answer.

Everything else is unsigned. Those four are the actions whose attribution the
review and grill gates depend on; signing reads would add verification cost to
the hot path to prove authorship of an action that changes nothing. The signed
payload binds worker id, action, target id, and a timestamp, so a signature
cannot be replayed against a different target.

### Registrations expire

Registration carries a TTL, defaulting to a configured
`ACP_WORKER_REGISTRATION_TTL`, refreshed by worker heartbeat. An expired
registration moves the worker to an `expired` status rather than being deleted —
its history and the events attributing work to it must survive.

This reuses ACP's existing TTL discipline: leases already expire and are already
swept. Expiry also composes with [[ADR-0021-work-unit-spawn-graph]] — an expired
worker with non-terminal work units is precisely the orphan signal the spawn
graph makes queryable, and neither ADR gives it alone.

### Opt-in, and unsigned workers stay first-class

Signature verification is enabled by `ACP_REQUIRE_WORKER_SIGNATURES`, default
off. With it off, unsigned registrations and claims work exactly as today. With
it on, an unsigned state-changing claim is refused.

Verification results are recorded either way: an event attributing work to a
worker records whether the claim was signed. An operator can therefore run
unenforced first, observe which workers sign, and enforce once coverage is
complete — the same staged path `ACP_REQUIRE_AUTH` already offers.

## Rationale

Separating provenance from authorization is what makes this safe to add. Every
alternative that folds signing into the auth path turns key handling into an
availability risk: a rotation bug becomes an outage. As pure attribution,
worst-case failure is a claim recorded as unverified.

The BOM justifies itself the first time something goes wrong. ACP's durable log
already answers what happened and in what order; the BOM is what turns that into
a diagnosis, and it costs three strings captured once at registration.

TTL'd registration is the smallest change with the widest reach — it uses
machinery that already exists for leases, and it converts "worker liveness" from
something inferred to something the host asserts.

## Consequences

Workers gain a key-management responsibility. Generating and storing a private
key is new work for every client, which is why enforcement is off by default and
why the unsigned path stays first-class indefinitely rather than being a
migration window.

`Worker` gains fields, so the OpenAPI contract regenerates. All additions are
optional or host-derived: an existing stored worker decodes with no public key,
no BOM, and no expiry, and behaves as it does today. Protocol stays at v0.1.

Enforcement makes signing failures a new class of refusal — HTTP 403, distinct
from a 401 session failure, because the session was fine and attribution was
not. `ACP-SKILL.md` and [[agent-integration]] must document the distinction
before enforcement is recommended.

Expiring registrations changes a long-standing behavior: a worker that stops
heartbeating now visibly becomes `expired`. Anything that treated a registration
as permanent needs to heartbeat. This is the intended correction, and the
default TTL should be generous enough that a busy worker never trips it.

## Alternatives

**Replacing bearer sessions with signed requests.** Rejected: makes key
management an availability dependency, discards the [[ADR-0015-trusted-session-issuance]]
work, and buys nothing that layering does not.

**Signing every request.** Rejected: verification cost on reads to prove
authorship of actions that change nothing.

**Mutable key rotation on a stable worker id.** Rejected: past signatures would
no longer verify, defeating the attribution the design exists for.
Re-registration is the rotation story.

**mTLS.** Rejected: moves identity into transport, so it cannot survive a proxy
hop — and ACP explicitly supports a Traefik edge — and it identifies a
connection, not a claim.

**Deleting expired registrations.** Rejected: events attribute work to worker
ids, and a dangling id destroys the audit trail the ADR is built to protect.

**Trusting a self-reported BOM without registration binding.** Rejected without
qualification only where signing is enforced; with signing off the BOM is
self-reported and is documented as such, since an unauthenticated claim about
one's own version is a hint, not evidence.

## Validation

Acceptance requires tests proving: a valid signature never widens access — a
session lacking a permission is refused regardless of signing; each of the four
signed actions rejects a signature bound to a different target id or worker id;
registration is rejected if it carries private key material; the BOM is
immutable after registration; TTL expiry moves a worker to `expired` while
preserving its id and every event referencing it; heartbeat refreshes TTL; with
enforcement off, unsigned workers behave byte-identically to today including
event payloads; with enforcement on, unsigned state-changing claims are refused
and reads are not; and a pre-existing stored worker row decodes and operates
unchanged.

Plus a dogfood script covering registration, a signed claim, TTL expiry of an
abandoned worker, and — jointly with ADR-0021 — surfacing that worker's orphaned
non-terminal work. And the full typecheck/lint/format/suite gate.

## Grill Log

- **Q:** Why not let a valid signature authorize, and drop a layer? **A:** It
  makes key rotation an outage risk and discards ADR-0015. Provenance failures
  should degrade to "unverified", never to "denied service". _Rejected:_ signing
  as an auth mechanism.
- **Q:** Why keep expired workers instead of deleting them? **A:** Events
  attribute work by worker id; deleting the row leaves dangling references and
  destroys the audit trail. _Rejected:_ hard deletion on expiry.
- **Q:** Is a self-reported BOM worth storing if a worker can lie? **A:** With
  signing enforced it is bound to a key the host verified. With signing off it
  is a hint, and is documented as one — but even a hint from cooperating
  first-party clients answers most incident questions. _Rejected:_ omitting the
  BOM until signing is mandatory.
- **Q:** Why sign four actions rather than all mutations? **A:** Those four are
  what the review and grill gates rest on. Extending later is additive; starting
  broad would slow every mutation to prove authorship nothing consumes.
  _Rejected:_ signing all mutations in v1.

## Referenced by

[[00-INDEX]]
