/** @Acp.Domain.Policy.Engine — declarative per-resource access rules */
import { Either, Schema } from 'effect'
import { ValidationError } from '../../protocol/errors/protocol-error.js'

/**
 * The actions a policy can govern. Closed, and deliberately narrower than the
 * hook points in [[ADR-0022-coordination-hooks]]: these are the two mutations
 * that name a *resource*, which is what a policy rule reasons about.
 */
export const PolicyAction = Schema.Literal('lease.grant', 'work.claim')
export type PolicyAction = typeof PolicyAction.Type

/**
 * `require_review` is codex's `prompt`, translated. Codex asks a human at a
 * terminal; ACP's callers are autonomous, so the faithful equivalent routes
 * through the review gate that already exists rather than inventing a second
 * approval channel. It is declared here but not yet enforced — see the ADR.
 */
export const PolicyDecision = Schema.Literal('allow', 'deny', 'require_review')
export type PolicyDecision = typeof PolicyDecision.Type

const ResourceMatcher = Schema.Struct({
  kind: Schema.optional(Schema.String),
  /** Exact, or a trailing `**` prefix wildcard. Deliberately not a full glob. */
  uri: Schema.NonEmptyString,
})

const Example = Schema.Struct({
  action: PolicyAction,
  worker: Schema.NonEmptyString,
  resourceKind: Schema.NonEmptyString,
  resourceUri: Schema.NonEmptyString,
})
export type Example = typeof Example.Type

const PolicyRule = Schema.Struct({
  name: Schema.NonEmptyString,
  action: PolicyAction,
  /** Absent means "any worker". */
  worker: Schema.optional(Schema.NonEmptyString),
  resource: ResourceMatcher,
  decision: PolicyDecision,
  /** Required on anything other than `allow`; enforced during load. */
  justification: Schema.optional(Schema.NonEmptyString),
  /** Invocations that must resolve to this rule. */
  match: Schema.optional(Schema.Array(Example)),
  /** Invocations that must not resolve to this rule. */
  notMatch: Schema.optional(Schema.Array(Example)),
})
export type PolicyRule = typeof PolicyRule.Type

/**
 * `default` is required. Either implicit choice is wrong for some operator, and
 * a permissive guess is how misconfiguration becomes a breach — writing rules
 * implies having considered the no-match case.
 */
export const PolicyDocument = Schema.Struct({
  default: PolicyDecision,
  rules: Schema.Array(PolicyRule),
})
export type PolicyDocument = typeof PolicyDocument.Type

export interface PolicyRequest {
  readonly action: PolicyAction
  readonly worker: string
  readonly resourceKind: string
  readonly resourceUri: string
}

export interface PolicyOutcome {
  readonly decision: PolicyDecision
  readonly justification?: string
  /** Absent when the outcome came from the document default. */
  readonly ruleName?: string
}

const WILDCARD = '**'

/** Exact match, or prefix match when the pattern ends in `**`. */
const uriMatches = (pattern: string, uri: string): boolean =>
  pattern.endsWith(WILDCARD)
    ? uri.startsWith(pattern.slice(0, -WILDCARD.length))
    : pattern === uri

const ruleMatches = (rule: PolicyRule, request: PolicyRequest): boolean =>
  rule.action === request.action &&
  (rule.worker === undefined || rule.worker === request.worker) &&
  (rule.resource.kind === undefined ||
    rule.resource.kind === request.resourceKind) &&
  uriMatches(rule.resource.uri, request.resourceUri)

/** First match wins — predictable to read, and cheap with no I/O. */
export const evaluatePolicy = (
  policy: PolicyDocument,
  request: PolicyRequest,
): PolicyOutcome => {
  const hit = policy.rules.find((rule) => ruleMatches(rule, request))
  return hit === undefined
    ? { decision: policy.default }
    : {
        decision: hit.decision,
        ruleName: hit.name,
        ...(hit.justification === undefined
          ? {}
          : { justification: hit.justification }),
      }
}

/** The rule a request resolves to under first-match-wins, if any. */
const resolveRuleName = (
  policy: PolicyDocument,
  request: PolicyRequest,
): string | undefined => evaluatePolicy(policy, request).ruleName

/**
 * Decodes a policy document and runs its own examples against it.
 *
 * Access rules rot silently: a pattern stops matching after a resource-naming
 * change and nobody notices until an incident. Making rules carry executable
 * examples turns that class of rot into a load failure. Note the examples are
 * checked against the *whole* document, so a rule shadowed by an earlier one
 * fails to load rather than sitting there never firing.
 */
export const loadPolicy = (
  document: unknown,
): Either.Either<PolicyDocument, ValidationError> => {
  const decoded = Schema.decodeUnknownEither(PolicyDocument)(document)
  if (Either.isLeft(decoded)) {
    return Either.left(new ValidationError({ issues: [String(decoded.left)] }))
  }
  const policy = decoded.right
  const issues: string[] = []

  const seen = new Set<string>()
  for (const rule of policy.rules) {
    if (seen.has(rule.name)) {
      issues.push(`duplicate rule name "${rule.name}"`)
    }
    seen.add(rule.name)

    // `require_review` is reserved vocabulary with no enforcement path yet: a
    // hook can only allow or deny, and routing a lease grant into the review
    // gate has no coherent meaning, since reviews are scoped to work units.
    // Refusing to load is the only honest option — silently treating it as
    // allow would be a hole, and as deny would be a lie about the operator's
    // intent. See [[ADR-0023-resource-access-policy]].
    if (rule.decision === 'require_review') {
      issues.push(
        `rule "${rule.name}" uses require_review, which is reserved but not yet enforced`,
      )
    }

    if (rule.decision !== 'allow' && rule.justification === undefined) {
      issues.push(
        `rule "${rule.name}" decides ${rule.decision} and must carry a justification`,
      )
    }

    for (const example of rule.match ?? []) {
      const resolved = resolveRuleName(policy, example)
      if (resolved !== rule.name) {
        issues.push(
          `rule "${rule.name}" declares a match example that resolves to ${
            resolved === undefined ? 'the document default' : `"${resolved}"`
          }`,
        )
      }
    }

    for (const example of rule.notMatch ?? []) {
      if (resolveRuleName(policy, example) === rule.name) {
        issues.push(
          `rule "${rule.name}" declares a notMatch example that resolves to it`,
        )
      }
    }
  }

  return issues.length === 0
    ? Either.right(policy)
    : Either.left(new ValidationError({ issues }))
}
