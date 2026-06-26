/** @Acp.Protocol.Schema.Test — decode/encode + Option behavior */
import { describe, it, expect } from 'vitest'
import { Schema, Option } from 'effect'
import {
  Worker,
  WorkUnit,
  Workspace,
  Lease,
  Event,
  CreateWorkPayload,
} from './index.js'

const decodeWorker = Schema.decodeUnknownSync(Worker)
const decodeWork = Schema.decodeUnknownSync(WorkUnit)

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
      name: 'acme/web',
      kind: 'git_repository',
      uri: 'git+https://github.com/acme/web.git',
      default_branch: 'main',
      metadata: { provider: 'github' },
    })
    expect(Option.getOrNull(ws.default_branch)).toBe('main')
    expect(ws.metadata.provider).toBe('github')
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
