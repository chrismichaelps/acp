/** @Acp.App.Server.NativeRpcRoute.Test — native Effect RPC over the live host socket */
import { HttpServer } from '@effect/platform'
import { Duration, Effect, Either, Fiber, Option, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import { RenewLeasePayload } from '../../infrastructure/http/acp-http-api.js'
import { nodeHttpServerLayer } from '../../infrastructure/platform-node/index.js'
import {
  AcpRpcs,
  acpRpcClientHostLayer,
  makeAcpRpcClient,
  withAcpRpcBearer,
} from '../../infrastructure/rpc/index.js'
import {
  decodeInitialize,
  decodePayload,
} from '../../infrastructure/rpc/acp-rpc-test-support.js'
import type { WorkerId } from '../../protocol/schema/index.js'
import { HttpAppLive } from './http-app.js'

const EphemeralServerLive = nodeHttpServerLayer(0)

const onLiveServer = <A>(use: (baseUrl: string) => Promise<A>) =>
  Effect.runPromise(
    HttpServer.addressWith((address) => {
      const port = address._tag === 'TcpAddress' ? address.port : 0
      return Effect.promise(() => use(`http://127.0.0.1:${port.toString()}`))
    }).pipe(
      Effect.provide(HttpAppLive),
      Effect.provide(EphemeralServerLive),
      Effect.scoped,
    ),
  )

describe('native RPC route', () => {
  it('serves the typed client over HTTP and shares state with REST', async () => {
    const result = await onLiveServer(async (baseUrl) => {
      const created = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* makeAcpRpcClient
          const session = yield* client.session.initialize(
            yield* decodeInitialize(['workspace:read', 'workspace:write']),
          )
          const authed = withAcpRpcBearer(session.session_id)
          const workspace = yield* authed(
            client.workspace.create(
              yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
                name: 'Native RPC Mounted Workspace',
                kind: 'git_repository',
                uri: 'git+https://example.com/acp/native-rpc.git',
              }),
            ),
          )
          const readOnly = yield* client.session.initialize(
            yield* decodeInitialize(['workspace:read']),
          )
          const denied = yield* Effect.either(
            withAcpRpcBearer(readOnly.session_id)(
              client.workspace.create(
                yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
                  name: 'Native RPC Denied Workspace',
                  kind: 'git_repository',
                  uri: 'git+https://example.com/acp/native-rpc-denied.git',
                }),
              ),
            ),
          )
          return { denied, sessionId: session.session_id, workspace }
        }).pipe(Effect.provide(acpRpcClientHostLayer(baseUrl)), Effect.scoped),
      )

      const rest = await fetch(`${baseUrl}/v1/workspaces`, {
        headers: { authorization: `Bearer ${created.sessionId}` },
      })
      const listed = (await rest.json()) as readonly { id: string }[]

      return { created, listed, restStatus: rest.status }
    })

    expect(result.created.workspace.name).toBe('Native RPC Mounted Workspace')
    expect(Either.isLeft(result.created.denied)).toBe(true)
    expect(result.restStatus).toBe(200)
    expect(result.listed.map((workspace) => workspace.id)).toContain(
      result.created.workspace.id,
    )
  })

  it('streams workspace events through the typed native RPC client', async () => {
    const result = await onLiveServer((baseUrl) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* makeAcpRpcClient
          const session = yield* client.session.initialize(
            yield* decodeInitialize([
              'workspace:write',
              'work:create',
              'work:publish_event',
              'event:read',
            ]),
          )
          const headers = { authorization: `Bearer ${session.session_id}` }
          const workspace = yield* client.workspace.create(
            yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
              name: 'Native RPC Event Stream Workspace',
              kind: 'git_repository',
              uri: 'git+https://example.com/acp/native-rpc-events.git',
            }),
            { headers },
          )
          const work = yield* client.work.create(
            yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
              workspace_id: workspace.id,
              title: 'Stream native event',
            }),
            { headers },
          )

          const stream = client.events.subscribe(
            { workspace_id: workspace.id },
            { headers },
          )
          const fiber = yield* Effect.fork(Stream.runHead(stream))
          yield* Effect.sleep(Duration.millis(25))
          const published = yield* client.work.publish_event(
            yield* decodePayload(AcpRpcs.workPublishEvent.payloadSchema, {
              work_id: work.id,
              type: 'work.progressed',
              data: { message: 'native rpc stream observed' },
            }),
            { headers },
          )
          const observed = yield* Fiber.join(fiber)
          return { observed, published }
        }).pipe(Effect.provide(acpRpcClientHostLayer(baseUrl)), Effect.scoped),
      ),
    )

    expect(Option.getOrNull(result.observed)?.id).toBe(result.published.id)
  })

  it('round-trips work and lease methods over HTTP', async () => {
    const result = await onLiveServer((baseUrl) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* makeAcpRpcClient
          const session = yield* client.session.initialize(
            yield* decodeInitialize([
              'worker:read',
              'workspace:read',
              'workspace:write',
              'work:create',
              'work:claim',
              'work:update',
              'lease:create',
              'lease:renew',
              'lease:release',
              'lease:revoke',
            ]),
          )
          const authed = withAcpRpcBearer(session.session_id)
          const worker = yield* authed(
            client.worker.get({ worker_id: 'agent_rpc' as WorkerId }),
          )
          const workspace = yield* authed(
            client.workspace.create(
              yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
                name: 'Native RPC Work Lease Workspace',
                kind: 'git_repository',
                uri: 'git+https://example.com/acp/native-rpc-work-lease.git',
              }),
            ),
          )
          const renamed = yield* authed(
            client.workspace.update(
              yield* decodePayload(AcpRpcs.workspaceUpdate.payloadSchema, {
                workspace_id: workspace.id,
                name: 'Native RPC Work Lease Workspace Renamed',
                kind: 'git_repository',
                uri: 'git+https://example.com/acp/native-rpc-work-lease.git',
              }),
            ),
          )
          const work = yield* authed(
            client.work.create(
              yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
                workspace_id: workspace.id,
                title: 'Claim and lease over native RPC',
              }),
            ),
          )
          const claimed = yield* authed(
            client.work.claim({ work_id: work.id, worker_id: worker.id }),
          )
          const running = yield* authed(
            client.work.update_state({ work_id: work.id, state: 'running' }),
          )
          const lease = yield* authed(
            client.lease.request(
              yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
                workspace_id: workspace.id,
                work_id: work.id,
                holder: worker.id,
                resource: {
                  kind: 'file',
                  uri: 'file://src/app/server/native-rpc-route.test.ts',
                },
              }),
            ),
          )
          const renewParams = yield* decodePayload(RenewLeasePayload, {})
          const renewed = yield* authed(
            client.lease.renew({ lease_id: lease.id, ...renewParams }),
          )
          const released = yield* authed(
            client.lease.release({ lease_id: lease.id }),
          )
          const releasedLeases = yield* authed(
            client.lease.list({ workspace_id: workspace.id }),
          )
          const secondLease = yield* authed(
            client.lease.request(
              yield* decodePayload(AcpRpcs.leaseRequest.payloadSchema, {
                workspace_id: workspace.id,
                work_id: work.id,
                holder: worker.id,
                resource: {
                  kind: 'file',
                  uri: 'file://src/app/server/native-rpc-route.work-lease.ts',
                },
              }),
            ),
          )
          const revoked = yield* authed(
            client.lease.revoke({ lease_id: secondLease.id }),
          )
          const finalLeases = yield* authed(
            client.lease.list({ workspace_id: workspace.id }),
          )
          const archived = yield* authed(
            client.workspace.archive({ workspace_id: workspace.id }),
          )

          return {
            archived,
            claimed,
            finalLeases,
            lease,
            released,
            releasedLeases,
            renewed,
            revoked,
            running,
            renamed,
          }
        }).pipe(Effect.provide(acpRpcClientHostLayer(baseUrl)), Effect.scoped),
      ),
    )

    expect(result.renamed.name).toBe('Native RPC Work Lease Workspace Renamed')
    expect(Option.getOrNull(result.claimed.assigned_to)).toBe('agent_rpc')
    expect(result.running.state).toBe('running')
    expect(result.renewed.state).toBe('active')
    expect(result.released).toBeUndefined()
    expect(
      result.releasedLeases.find((lease) => lease.id === result.lease.id)
        ?.state,
    ).toBe('released')
    expect(
      result.finalLeases.find((lease) => lease.id === result.revoked.id)?.state,
    ).toBe('revoked')
    expect(result.revoked.state).toBe('revoked')
    expect(result.archived.state).toBe('archived')
  })

  it('round-trips artifact and checkpoint methods over HTTP', async () => {
    const result = await onLiveServer((baseUrl) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* makeAcpRpcClient
          const session = yield* client.session.initialize(
            yield* decodeInitialize([
              'workspace:read',
              'workspace:write',
              'work:create',
              'artifact:create',
              'artifact:update',
              'checkpoint:create',
            ]),
          )
          const authed = withAcpRpcBearer(session.session_id)
          const workspace = yield* authed(
            client.workspace.create(
              yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
                name: 'Native RPC Artifact Checkpoint Workspace',
                kind: 'git_repository',
                uri: 'git+https://example.com/acp/native-rpc-artifacts.git',
              }),
            ),
          )
          const work = yield* authed(
            client.work.create(
              yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
                workspace_id: workspace.id,
                title: 'Persist artifact and checkpoint over native RPC',
              }),
            ),
          )
          const artifact = yield* authed(
            client.artifact.create(
              yield* decodePayload(AcpRpcs.artifactCreate.payloadSchema, {
                workspace_id: workspace.id,
                work_id: work.id,
                kind: 'patch',
                summary: 'Mounted transport patch',
                content: 'diff --git a/http-roundtrip.ts b/http-roundtrip.ts',
              }),
            ),
          )
          const updated = yield* authed(
            client.artifact.update(
              yield* decodePayload(AcpRpcs.artifactUpdate.payloadSchema, {
                artifact_id: artifact.id,
                kind: 'patch',
                summary: 'Mounted transport patch revised',
                content:
                  'diff --git a/http-roundtrip.ts b/http-roundtrip-revised.ts',
              }),
            ),
          )
          const content = yield* authed(
            client.artifact.content({ artifact_id: artifact.id }),
          )
          const checkpoint = yield* authed(
            client.checkpoint.create(
              yield* decodePayload(AcpRpcs.checkpointCreate.payloadSchema, {
                workspace_id: workspace.id,
                work_id: work.id,
                summary: 'Mounted transport checkpoint',
                completed_steps: ['created artifact over mounted native RPC'],
                remaining_steps: ['continue transport parity coverage'],
                modified_resources: [
                  'file://src/app/server/native-rpc-route.ts',
                ],
              }),
            ),
          )
          const latest = yield* authed(
            client.checkpoint.latest_for_work({ work_id: work.id }),
          )
          const artifacts = yield* authed(
            client.artifact.list_for_workspace({ workspace_id: workspace.id }),
          )

          return { artifact, artifacts, checkpoint, content, latest, updated }
        }).pipe(Effect.provide(acpRpcClientHostLayer(baseUrl)), Effect.scoped),
      ),
    )

    expect(result.updated.id).toBe(result.artifact.id)
    expect(result.content.content).toContain('http-roundtrip-revised.ts')
    expect(result.artifacts.map((artifact) => artifact.id)).toContain(
      result.artifact.id,
    )
    expect(result.latest.id).toBe(result.checkpoint.id)
  })

  it('round-trips review, memory, and event reads over HTTP', async () => {
    const result = await onLiveServer((baseUrl) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* makeAcpRpcClient
          const session = yield* client.session.initialize(
            yield* decodeInitialize([
              'workspace:read',
              'workspace:write',
              'work:create',
              'work:claim',
              'work:update',
              'work:publish_event',
              'review:create',
              'review:approve',
              'memory:create',
              'memory:read',
              'event:read',
            ]),
          )
          const authed = withAcpRpcBearer(session.session_id)
          const workspace = yield* authed(
            client.workspace.create(
              yield* decodePayload(AcpRpcs.workspaceCreate.payloadSchema, {
                name: 'Native RPC Review Memory Workspace',
                kind: 'git_repository',
                uri: 'git+https://example.com/acp/native-rpc-review-memory.git',
              }),
            ),
          )
          const work = yield* authed(
            client.work.create(
              yield* decodePayload(AcpRpcs.workCreate.payloadSchema, {
                workspace_id: workspace.id,
                title: 'Review and remember over native RPC',
              }),
            ),
          )
          yield* authed(
            client.work.claim({
              work_id: work.id,
              worker_id: 'agent_rpc' as WorkerId,
            }),
          )
          const running = yield* authed(
            client.work.update_state({ work_id: work.id, state: 'running' }),
          )
          const requested = yield* authed(
            client.review.request(
              yield* decodePayload(AcpRpcs.reviewRequest.payloadSchema, {
                work_id: running.id,
                requested_by: 'agent_rpc',
                requirements: [],
              }),
            ),
          )
          const approved = yield* authed(
            client.review.approve({
              review_id: requested.id,
              met_requirements: [],
            }),
          )
          const memory = yield* authed(
            client.memory.create(
              yield* decodePayload(AcpRpcs.memoryCreate.payloadSchema, {
                workspace_id: workspace.id,
                work_id: running.id,
                kind: 'decision',
                key: 'rpc.http.review-memory',
                summary: 'Mounted transport review approved.',
                content: 'review.approve and memory.create crossed HTTP.',
                labels: ['rpc', 'http'],
              }),
            ),
          )
          const memories = yield* authed(
            client.memory.list(
              yield* decodePayload(AcpRpcs.memoryList.payloadSchema, {
                workspace_id: workspace.id,
                after_seq: 0,
              }),
            ),
          )
          const published = yield* authed(
            client.work.publish_event(
              yield* decodePayload(AcpRpcs.workPublishEvent.payloadSchema, {
                work_id: running.id,
                type: 'work.progressed',
                data: { message: 'review-memory http roundtrip' },
              }),
            ),
          )
          const events = yield* authed(
            client.events.list({
              workspace_id: workspace.id,
              after_seq: 0,
              limit: Option.none(),
            }),
          )

          return { approved, events, memories, memory, published, requested }
        }).pipe(Effect.provide(acpRpcClientHostLayer(baseUrl)), Effect.scoped),
      ),
    )

    expect(result.approved.id).toBe(result.requested.id)
    expect(result.approved.state).toBe('approved')
    expect(result.memories.map((memory) => memory.id)).toContain(
      result.memory.id,
    )
    expect(result.events.map((event) => event.id)).toContain(
      result.published.id,
    )
  })
})
