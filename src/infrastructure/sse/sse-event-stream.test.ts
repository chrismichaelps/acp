/** @Acp.Infra.Sse.EventStream.Test — Server-Sent Event rendering */
import { describe, expect, it } from 'vitest'
import { Effect, Schema, Stream } from 'effect'
import { Event } from '../../protocol/schema/index.js'
import {
  collectSseText,
  encodeSseEventFrame,
  eventsToSseBytes,
  heartbeatFrame,
  sseContentType,
  toSseResponse,
} from './index.js'

const event = Schema.decodeUnknownSync(Event)({
  id: 'event_sse_1',
  type: 'work.claimed',
  workspace_id: 'workspace_sse',
  work_id: 'work_sse',
  actor: 'agent_codex',
  timestamp: '2026-06-26T01:35:00Z',
  seq: 7,
  data: { note: 'claimed' },
})

describe('SSE event stream', () => {
  it('renders a typed event as an SSE frame', () => {
    const frame = Effect.runSync(encodeSseEventFrame(event))

    expect(frame.startsWith('event: work.claimed\n')).toBe(true)
    expect(frame).toContain('"id":"event_sse_1"')
    expect(frame).toContain('"work_id":"work_sse"')
    expect(frame.endsWith('\n\n')).toBe(true)
  })

  it('renders event streams as UTF-8 bytes', async () => {
    const text = await Effect.runPromise(
      collectSseText(eventsToSseBytes(Stream.make(event))),
    )

    expect(text).toContain('event: work.claimed')
    expect(text).toContain('"seq":7')
  })

  it('builds a streaming HTTP response with SSE headers', () => {
    const response = toSseResponse(Stream.make(event))

    expect(response.status).toBe(200)
    expect(response.body._tag).toBe('Stream')
    expect(response.body.contentType).toBe(sseContentType)
  })

  it('uses comment heartbeats for idle connections', () => {
    expect(heartbeatFrame).toBe(': heartbeat\n\n')
  })
})
