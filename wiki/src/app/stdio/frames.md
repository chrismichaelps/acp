---
type: module
path: '@root/src/app/stdio/frames.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, app, stdio, json-rpc]
aliases: [stdio-frames]
---

# Stdio Frames

## Purpose

Encode and decode Content-Length framed JSON-RPC messages for stdio transports.
The module is pure: it does not parse JSON, execute protocol methods, perform
network I/O, or touch Node streams. It exists so the byte-framing rules are
testable independently from the bridge process.

## Interface

### Signatures

```typescript
export interface StdioDecodeResult {
  readonly messages: readonly string[]
  readonly rest: Uint8Array
}

export class StdioFrameError extends Data.TaggedError('StdioFrameError')<{
  readonly message: string
}> {}

export const appendFrameBytes: (
  buffer: Uint8Array,
  chunk: Uint8Array,
) => Uint8Array
export const encodeStdioFrame: (message: string) => Uint8Array
export const decodeStdioFrames: (
  input: Uint8Array,
) => Either<StdioDecodeResult, StdioFrameError>
```

### Linkage

- **Requires:** `effect` `Data`/`Either`, platform `TextEncoder`/`TextDecoder`.
- **Consumed by:** [[stdio-main]].

## Algorithm

Encoding computes the UTF-8 byte length of the JSON text, writes
`Content-Length: n\r\n\r\n`, and appends the original bytes. Decoding scans for
the header separator, validates a non-negative safe integer `Content-Length`,
waits when a body is incomplete, and returns decoded message strings plus the
remaining unconsumed bytes. Multiple frames in one buffer are emitted in order.
Malformed headers fail with `StdioFrameError`; incomplete frames are not errors.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT count JavaScript string characters as body length; stdio framing uses bytes.
- ❌ Do NOT parse JSON in the frame codec.
- ❌ Do NOT discard an incomplete frame; return it as `rest`.
- ❌ Do NOT let unbounded headers grow past the maximum header length.

## Depth

DEEP (0.72). Correct byte framing is the stdio adapter's primary failure mode,
especially with partial chunks and non-ASCII payloads.

## Referenced by

[[stdio-index]] · [[stdio-main]] · [[Transport]] · [[src/_MOC]]
