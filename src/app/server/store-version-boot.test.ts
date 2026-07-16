/** @Acp.App.Server.StoreVersionBoot.Test — the guard actually gates host boot */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Cause, Effect, Exit, Layer, Option } from 'effect'
import { HttpServer } from '@effect/platform'
import { nodeHttpServerLayer } from '../../infrastructure/platform-node/index.js'
import {
  makeSqliteStorageLive,
  Storage,
} from '../../infrastructure/storage/index.js'
import { ACP_PROTOCOL_VERSION } from '../../protocol/version.js'
import { HttpAppLive } from './http-app.js'

const META_COLLECTION = 'store_meta'
const META_ID = 'protocol_version'

// A file-backed sqlite store is shared across connections, so a stamp written
// by one layer is visible to the host built later over the same path — the only
// way to exercise the wired boot against a pre-existing, incompatible store
// (AppLive constructs its own config-selected Storage, so it cannot be injected
// in-memory).
const stampFile = (path: string, version: string) =>
  Effect.gen(function* () {
    const storage = yield* Storage
    yield* storage.putIfAbsent(META_COLLECTION, META_ID, { version })
  }).pipe(Effect.provide(makeSqliteStorageLive(path)), Effect.scoped)

// Build the whole host over an ephemeral socket and the sqlite file selected via
// config (ACP_SQLITE_PATH, set per test). Building forces ServerRuntimeLive —
// and thus the guard — to run; we never launch the forever-server, only observe
// whether the build succeeds.
const buildHost = () =>
  Effect.scoped(Layer.build(HttpAppLive)).pipe(
    Effect.provide(nodeHttpServerLayer(0)),
    Effect.provide(HttpServer.layerContext),
    Effect.exit,
    Effect.runPromise,
  )

describe('store version guard at host boot', () => {
  let dir: string
  let dbPath: string
  const prevAdapter = process.env.ACP_STORAGE_ADAPTER
  const prevPath = process.env.ACP_SQLITE_PATH

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'acp-boot-'))
    dbPath = join(dir, 'store.db')
    process.env.ACP_STORAGE_ADAPTER = 'sqlite'
    process.env.ACP_SQLITE_PATH = dbPath
  })

  afterEach(() => {
    if (prevAdapter === undefined) delete process.env.ACP_STORAGE_ADAPTER
    else process.env.ACP_STORAGE_ADAPTER = prevAdapter
    if (prevPath === undefined) delete process.env.ACP_SQLITE_PATH
    else process.env.ACP_SQLITE_PATH = prevPath
    rmSync(dir, { recursive: true, force: true })
  })

  it('fails closed when the persisted store version is unsupported', async () => {
    await Effect.runPromise(stampFile(dbPath, '9.9'))

    const exit = await buildHost()

    expect(Exit.isFailure(exit)).toBe(true)
    const failure = Exit.isFailure(exit)
      ? Cause.failureOption(exit.cause)
      : Option.none()
    expect(Option.getOrNull(failure)).toMatchObject({
      _tag: 'IncompatibleStoreVersionError',
      stored: '9.9',
    })
  })

  it('boots and stamps a fresh store, then boots again against its own stamp', async () => {
    const first = await buildHost()
    expect(Exit.isSuccess(first)).toBe(true)

    const stamped = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage
        return yield* storage.get(META_COLLECTION, META_ID)
      }).pipe(Effect.provide(makeSqliteStorageLive(dbPath)), Effect.scoped),
    )
    expect(Option.getOrNull(stamped)).toEqual({ version: ACP_PROTOCOL_VERSION })

    const second = await buildHost()
    expect(Exit.isSuccess(second)).toBe(true)
  })
})
