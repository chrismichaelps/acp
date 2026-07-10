---
type: module
path: '@root/src/app/stdio/frames.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, stdio, json-rpc]
aliases: [stdio-frames.test, frames.test]
---

# Stdio Frame Tests

## Purpose

Prove [[stdio-frames]] preserves the byte-level Content-Length contract across
UTF-8 content, partial input, coalesced frames, and malformed headers.

## Interface

Vitest suite for `encodeStdioFrame`, `decodeStdioFrames`, and
`appendFrameBytes`; helpers unwrap successful Effect `Either` results.

## Algorithm

Encode a non-ASCII message and assert the header uses UTF-8 byte length. Decode a
complete frame with no remainder, split a frame before its final bytes and
resume it, decode two concatenated frames in order, and assert a non-numeric
Content-Length returns `Left`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT measure JavaScript character count for Content-Length.
- ❌ Do NOT treat an incomplete frame as malformed or discard its remainder.
- ❌ Do NOT accept a malformed length header as an empty frame.
- ❌ Do NOT test JSON parsing here; the codec contract is byte framing only.

## Grill Log

- **Q:** Why preserve the two-byte partial remainder? **A:** Stream chunks may
  end anywhere; successful resumption proves the decoder is incremental rather
  than packet-oriented. _Rejected:_ tests that feed only complete buffers.

## Referenced by

[[stdio-frames]] · [[stdio/_MOC]] · [[Transport]] · [[src/_MOC]]
