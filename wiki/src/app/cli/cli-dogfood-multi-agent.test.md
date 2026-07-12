---
type: module
path: '@root/src/app/cli/cli-dogfood-multi-agent.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, dogfood, multi-agent]
aliases: [cli-dogfood-multi-agent.test]
---

# Multi-Agent CLI Dogfood Tests

## Purpose

Prove the real [[cli-commands]] → [[cli-client]] path can drive ACP's complete
v0.1 collaboration loop over a live ephemeral socket with racing planner,
worker, and reviewer identities.

## Interface

Vitest integration suite composed over [[cli-dogfood-support]]. It is the
build-free CI twin of the compiled-binary multi-agent dogfood script.

## Algorithm

Initialize four scoped agents, create workspace/work, and persist planner
checkpoint and memory. Race two workers for the work claim and then the same
worktree lease, requiring exactly one winner and one typed conflict in each
race. Renew/read the lease; publish worker checkpoint, handoff memory, and test
artifact; and read the handoff back as reviewer. Drive a failed grill with an
open comment and changes request, confirm resume exposes both blockers, then
drive a second review with accepted blocker and resolved comment to approval.
Release the lease, complete work, and require the replayed event sequence to be
strictly monotonic and include lifecycle, comment, and grill events.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT bypass the real parser/client stack with synthetic HTTP calls.
- ❌ Do NOT accept two winners, zero winners, or an unexpected error in either
  concurrency race.
- ❌ Do NOT allow a failed grill or open comment to disappear from resume.
- ❌ Do NOT approve before the passing grill round and comment resolution.
- ❌ Do NOT expose bearer tokens in assertions or logs.

## Grill Log

- **Q:** Why keep a large vertical test when focused suites exist? **A:** Only
  this scenario proves permissioned identities, contention, handoff evidence,
  review recovery, and ordered events compose through the public CLI. _Rejected:_
  service-level substitutes that miss transport and auth seams.

## Referenced by

[[cli-dogfood-support]] · [[cli-commands]] · [[cli-client]] · [[cli/_MOC]] ·
[[Transport]] · [[src/_MOC]]
