---
type: reference
tags: [reference]
aliases: [external-protocols, mcp-alignment, ibm-acp]
---

# External Protocol Alignment (MCP · IBM ACP)

Grounding notes for the ACP reference implementation against two adjacent
standards. These validate the spec's transport/session design; they do not change
the domain-service contracts (which are ACP-internal). Captured 2026-06-26.

## Model Context Protocol (MCP)

- **Source:** <https://modelcontextprotocol.io/docs/learn/architecture>
- **Shape:** host ↔ client ↔ server; JSON-RPC 2.0 data layer over a transport layer
  (stdio or Streamable HTTP with optional SSE).
- **Lifecycle = capability negotiation.** `initialize` exchanges `protocolVersion`,
  `capabilities`, and `clientInfo`/`serverInfo`; the client then sends
  `notifications/initialized`. → Mirrors ACP `POST /v1/session/initialize`
  ([[acp-http-api]], spec §9). **Takeaway:** the initialize *response* must echo a
  negotiated `protocol_version` and the host's supported capability flags, and an
  incompatible version must terminate the session.
- **Notifications** are JSON-RPC messages with no `id` and no response — used for
  real-time, capability-gated updates (e.g. `notifications/tools/list_changed`).
  → Maps to ACP's append-only [[Event]] stream over [[EventStream]] (SSE). ACP's
  events are durable + replayable (monotonic `seq`), a superset of MCP's fire-and-
  forget notifications.
- **Stateful by default**, with a stateless subset over Streamable HTTP. → ACP is
  state-first (spec §4.1); [[Workspace]] is the state-ownership unit.

## IBM / Linux Foundation ACP

- **Source:** <https://agentcommunicationprotocol.dev> (the `ibm.com/think` page is
  403 to automated fetch).
- **Shape:** a standardized **RESTful** API for cross-framework agent interop;
  **async-first** with full sync support; streaming; stateful or stateless;
  online/offline agent discovery; long-running tasks.
- **"Standardized handoffs"** between specialized agents on shared workflows. → This
  is exactly ACP's coordination core: [[WorkUnit]] claim → [[Lease]] →
  [[Review]] handoff between [[Worker]]s, all observable via [[Event]]s.
- **No vendor lock-in** (BeeAI / LangChain / CrewAI / custom interoperate). → ACP's
  [[Worker]] `kind`/`vendor` fields and capability flags serve the same goal.

## Net effect on this implementation

1. Confirm `InitializeSessionResponse` carries `protocol_version` + host capability
   flags (already declared in [[acp-http-api]]); enforce version compatibility when
   the session handler slice lands.
2. Keep the event model durable + replayable (already true via [[EventStore]] `seq`)
   — it strictly subsumes MCP-style notifications.
3. No domain-contract changes for [[Lease]], [[Artifact]], [[Checkpoint]],
   [[Review]]; proceed with the planned slices.

## Referenced by

[[00-INDEX]] · [[acp-http-api]] · [[EventStream]]
