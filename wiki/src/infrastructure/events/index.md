---
type: module
path: '@root/src/infrastructure/events/index.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, medium]
aliases: [events-index]
---

# Infrastructure Events Barrel

## Purpose

Expose concrete cross-replica [[Event]] fan-out adapters behind one infrastructure
entrypoint.

## Interface

Re-exports [[pg-notify-event-broker]].

## Algorithm

Static ESM re-export only.

## Negative Logic

- ❌ Do NOT expose domain event-store internals or construct Layers here.

## Depth

MEDIUM (0.45). A stable barrel hides adapter file layout from composition callers.

## Grill Log

- **Q:** Why is the in-process broker absent? **A:** It lives with the domain
  [[EventBroker]] service; this folder owns concrete infrastructure adapters only.

## Referenced by

[[events/_MOC]] · [[infrastructure/_MOC]]
