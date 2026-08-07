/** @Acp.Domain.Policy.Overlay.Test — a workspace may narrow, never widen */
import { describe, expect, it } from 'vitest'
import { Either, Option } from 'effect'
import { loadPolicy } from './policy-engine.js'
import type { PolicyDocument, PolicyRequest } from './policy-engine.js'
import { evaluateWithOverlay } from './policy-overlay.js'

const doc = (
  fallback: string,
  rules: readonly unknown[] = [],
): PolicyDocument => {
  const result = loadPolicy({ default: fallback, rules })
  if (Either.isLeft(result)) {
    throw new Error(`policy failed to load: ${result.left.issues.join('; ')}`)
  }
  return result.right
}

const denyRule = (name: string, uri: string) => ({
  name,
  action: 'lease.grant',
  resource: { uri },
  decision: 'deny',
  justification: `${uri} is closed`,
})

const allowRule = (name: string, uri: string) => ({
  name,
  action: 'lease.grant',
  resource: { uri },
  decision: 'allow',
})

const request: PolicyRequest = {
  action: 'lease.grant',
  worker: 'agent_a',
  resourceKind: 'file',
  resourceUri: 'file:///src/app.ts',
}

const decide = (host: PolicyDocument, overlay: Option.Option<PolicyDocument>) =>
  evaluateWithOverlay(host, overlay, request).decision

describe('policy overlay', () => {
  it('falls back to the host policy when no overlay is configured', () => {
    expect(decide(doc('allow'), Option.none())).toBe('allow')
    expect(decide(doc('deny'), Option.none())).toBe('deny')
  })

  it('lets an overlay deny what the host allows', () => {
    const overlay = doc('allow', [denyRule('freeze', 'file:///src/**')])
    expect(decide(doc('allow'), Option.some(overlay))).toBe('deny')
  })

  it('lets an overlay tighten the default', () => {
    expect(decide(doc('allow'), Option.some(doc('deny')))).toBe('deny')
  })

  // The load-bearing rule: a workspace file must never become a way to grant
  // what the host refused, or an overlay would be a privilege-escalation path.
  it('does not let an overlay allow what the host denies', () => {
    const host = doc('allow', [denyRule('host-freeze', 'file:///src/**')])
    const overlay = doc('allow', [allowRule('exempt', 'file:///src/**')])
    expect(decide(host, Option.some(overlay))).toBe('deny')
  })

  it('does not let a permissive overlay default widen a host deny', () => {
    expect(decide(doc('deny'), Option.some(doc('allow')))).toBe('deny')
  })

  it('allows only when host and overlay both allow', () => {
    expect(decide(doc('allow'), Option.some(doc('allow')))).toBe('allow')
  })
})

describe('policy overlay — attribution', () => {
  it('reports the overlay rule when the overlay is what denied', () => {
    const overlay = doc('allow', [
      denyRule('workspace-freeze', 'file:///src/**'),
    ])
    const outcome = evaluateWithOverlay(
      doc('allow'),
      Option.some(overlay),
      request,
    )
    expect(outcome.ruleName).toBe('workspace-freeze')
    expect(outcome.justification).toBe('file:///src/** is closed')
  })

  it('reports the host rule when the host is what denied', () => {
    const host = doc('allow', [denyRule('host-freeze', 'file:///src/**')])
    const outcome = evaluateWithOverlay(
      host,
      Option.some(doc('allow')),
      request,
    )
    expect(outcome.ruleName).toBe('host-freeze')
  })

  // An operator debugging a refusal needs to know which file to edit, so the
  // overlay is named first when both would refuse.
  it('prefers the overlay when both deny', () => {
    const host = doc('allow', [denyRule('host-freeze', 'file:///src/**')])
    const overlay = doc('allow', [denyRule('ws-freeze', 'file:///src/**')])
    const outcome = evaluateWithOverlay(host, Option.some(overlay), request)
    expect(outcome.ruleName).toBe('ws-freeze')
  })
})
