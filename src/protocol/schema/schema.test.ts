/** @Acp.Protocol.Schema.Test — decode/encode + Option behavior */
import { describe, it, expect } from 'vitest'
import { Schema, Option } from 'effect'
import {
  Worker,
  WorkUnit,
  Workspace,
  Lease,
  Event,
  Memory,
  CreateMemoryPayload,
  ReadMemoryQuery,
  CreateWorkPayload,
  Review,
  Session,
} from './index.js'

const decodeWorker = Schema.decodeUnknownSync(Worker)
const decodeWork = Schema.decodeUnknownSync(WorkUnit)
const decodeSession = Schema.decodeUnknownSync(Session)

describe('Worker schema', () => {
  it('decodes a valid worker and brands the id', () => {
    const w = decodeWorker({
      id: 'agent_claude_code',
      name: 'Claude Code',
      kind: 'agent',
      vendor: 'anthropic',
      status: 'online',
      capabilities: ['can_edit_files', 'can_review'],
    })
    expect(w.id).toBe('agent_claude_code')
    expect(Option.getOrNull(w.vendor)).toBe('anthropic')
    expect(w.capabilities).toEqual(['can_edit_files', 'can_review'])
  })

  it('maps an omitted optional field to Option.none', () => {
    const w = decodeWorker({
      id: 'agent_x',
      name: 'X',
      kind: 'bot',
      status: 'idle',
      capabilities: [],
    })
    expect(Option.isNone(w.vendor)).toBe(true)
  })

  it('rejects an unknown kind', () => {
    expect(() =>
      decodeWorker({
        id: 'a',
        name: 'A',
        kind: 'wizard',
        status: 'online',
        capabilities: [],
      }),
    ).toThrow()
  })
})

describe('Session schema', () => {
  it('defaults workspace binding to Option.none for existing sessions', () => {
    const session = decodeSession({
      id: 'session_abc',
      worker_id: 'agent_codex',
      created_at: '2026-07-04T00:00:00Z',
      permissions: ['work:create'],
    })

    expect(Option.isNone(session.workspace_ids)).toBe(true)
  })

  it('decodes explicit workspace bindings', () => {
    const session = decodeSession({
      id: 'session_bound',
      worker_id: 'agent_codex',
      created_at: '2026-07-04T00:00:00Z',
      permissions: ['workspace:read'],
      workspace_ids: ['workspace_a', 'workspace_b'],
    })

    expect(Option.getOrThrow(session.workspace_ids)).toEqual([
      'workspace_a',
      'workspace_b',
    ])
  })
})

describe('WorkUnit schema', () => {
  it('decodes a full work unit with Option assigned_to', () => {
    const wu = decodeWork({
      id: 'work_123',
      workspace_id: 'workspace_123',
      title: 'Fix login redirect bug',
      description: null,
      state: 'open',
      priority: 'high',
      created_by: 'human_chris',
      assigned_to: null,
      created_at: '2026-06-25T19:00:00Z',
      updated_at: '2026-06-25T19:00:00Z',
    })
    expect(wu.state).toBe('open')
    expect(Option.isNone(wu.assigned_to)).toBe(true)
    expect(Option.isNone(wu.description)).toBe(true)
  })

  it('rejects an empty title (NonEmptyString)', () => {
    expect(() =>
      decodeWork({
        id: 'work_1',
        workspace_id: 'ws_1',
        title: '',
        state: 'open',
        priority: 'normal',
        created_by: 'u',
        created_at: '2026-06-25T19:00:00Z',
        updated_at: '2026-06-25T19:00:00Z',
      }),
    ).toThrow()
  })

  it('decodes changes_requested from the state machine', () => {
    const wu = decodeWork({
      id: 'work_changes_requested',
      workspace_id: 'workspace_123',
      title: 'Address review feedback',
      state: 'changes_requested',
      priority: 'normal',
      created_by: 'human_chris',
      created_at: '2026-06-26T01:30:00Z',
      updated_at: '2026-06-26T01:30:00Z',
    })
    expect(wu.state).toBe('changes_requested')
  })
})

describe('CreateWorkPayload', () => {
  it('defaults priority to Option.none when omitted', () => {
    const p = Schema.decodeUnknownSync(CreateWorkPayload)({
      workspace_id: 'ws_1',
      title: 'do a thing',
    })
    expect(Option.isNone(p.priority)).toBe(true)
  })
})

describe('Workspace / Lease / Event schemas', () => {
  it('decodes a git workspace with metadata', () => {
    const ws = Schema.decodeUnknownSync(Workspace)({
      id: 'workspace_123',
      name: 'example/workspace',
      kind: 'git_repository',
      uri: 'git+https://example.com/workspaces/main.git',
      default_branch: 'main',
      metadata: { provider: 'github' },
    })
    expect(Option.getOrNull(ws.default_branch)).toBe('main')
    expect(ws.metadata.provider).toBe('github')
    expect(ws.state).toBe('active')
  })

  it('decodes a lease with a nested resource', () => {
    const l = Schema.decodeUnknownSync(Lease)({
      id: 'lease_123',
      workspace_id: 'workspace_123',
      work_id: 'work_123',
      holder: 'agent_claude_code',
      resource: { kind: 'file', uri: 'file://src/auth/callback.ts' },
      expires_at: '2026-06-25T19:15:00Z',
      state: 'active',
    })
    expect(l.resource.kind).toBe('file')
  })

  it('decodes an event and rejects an unknown type', () => {
    const e = Schema.decodeUnknownSync(Event)({
      id: 'event_123',
      type: 'work.claimed',
      workspace_id: 'workspace_123',
      actor: 'agent_claude_code',
      timestamp: '2026-06-25T19:02:00Z',
      seq: 1,
      data: {},
    })
    expect(e.type).toBe('work.claimed')
    expect(() =>
      Schema.decodeUnknownSync(Event)({
        id: 'event_124',
        type: 'work.exploded',
        workspace_id: 'ws',
        actor: 'a',
        timestamp: '2026-06-25T19:02:00Z',
        seq: 2,
        data: {},
      }),
    ).toThrow()
  })
})

describe('Memory schema', () => {
  it('decodes memory records and payload filters', () => {
    const memory = Schema.decodeUnknownSync(Memory)({
      id: 'memory_123',
      workspace_id: 'workspace_123',
      work_id: 'work_123',
      seq: 3,
      created_by: 'agent_claude_code',
      kind: 'decision',
      key: 'auth.redirect.async-session',
      summary: 'Redirect waits for session creation.',
      content: 'The callback awaits session creation before navigation.',
      labels: ['auth', 'handoff'],
      created_at: '2026-06-25T19:11:00Z',
    })
    const payload = Schema.decodeUnknownSync(CreateMemoryPayload)({
      workspace_id: 'workspace_123',
      kind: 'note',
      key: 'handoff.note',
      summary: 'Short note.',
      content: 'Useful for the next worker.',
      labels: [],
    })
    const query = Schema.decodeUnknownSync(ReadMemoryQuery)({
      workspace_id: 'workspace_123',
      after_seq: 2,
      key: 'auth.redirect.async-session',
    })

    expect(memory.seq).toBe(3)
    expect(Option.isNone(payload.work_id)).toBe(true)
    expect(Option.getOrNull(query.key)).toBe('auth.redirect.async-session')
  })

  it('decodes memory.created events', () => {
    const e = Schema.decodeUnknownSync(Event)({
      id: 'event_memory_123_created',
      type: 'memory.created',
      workspace_id: 'workspace_123',
      actor: 'agent_claude_code',
      timestamp: '2026-06-25T19:11:00Z',
      seq: 1,
      data: { memory_id: 'memory_123' },
    })
    expect(e.type).toBe('memory.created')
  })
})

describe('Review schema', () => {
  it('decodes optional approval signature evidence', () => {
    const review = Schema.decodeUnknownSync(Review)({
      id: 'review_signed',
      work_id: 'work_signed',
      requested_by: 'agent_worker',
      reviewer: 'human_chris',
      state: 'approved',
      requirements: ['tests_pass'],
      approval_signature: {
        algorithm: 'ssh-ed25519',
        key_id: 'github:user:human_chris:key1',
        value: 'sig:v1:abc123',
        signed_at: '2026-07-05T01:30:00.000Z',
      },
      created_at: '2026-07-05T01:00:00.000Z',
    })

    expect(Option.getOrThrow(review.approval_signature)).toEqual({
      algorithm: 'ssh-ed25519',
      key_id: 'github:user:human_chris:key1',
      value: 'sig:v1:abc123',
      signed_at: Option.some('2026-07-05T01:30:00.000Z'),
    })
  })
})
