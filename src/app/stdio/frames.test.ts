import { Either } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  appendFrameBytes,
  decodeStdioFrames,
  encodeStdioFrame,
} from './frames.js'

const text = new TextDecoder()
const bytes = new TextEncoder()

const right = <A, E>(value: Either.Either<A, E>): A => {
  if (Either.isLeft(value)) {
    throw new Error(`expected Right, got ${String(value.left)}`)
  }
  return value.right
}

describe('stdio JSON-RPC frames', () => {
  it('encodes Content-Length using UTF-8 byte length', () => {
    const encoded = encodeStdioFrame('{"msg":"hola ñ"}')
    expect(text.decode(encoded)).toBe(
      'Content-Length: 17\r\n\r\n{"msg":"hola ñ"}',
    )
  })

  it('decodes a complete frame and leaves no rest', () => {
    const decoded = right(decodeStdioFrames(encodeStdioFrame('{"id":1}')))
    expect(decoded.messages).toEqual(['{"id":1}'])
    expect(decoded.rest.byteLength).toBe(0)
  })

  it('keeps an incomplete frame in rest until enough bytes arrive', () => {
    const frame = encodeStdioFrame('{"id":2}')
    const partial = frame.slice(0, frame.length - 2)
    const first = right(decodeStdioFrames(partial))
    expect(first.messages).toEqual([])
    expect(first.rest.byteLength).toBe(partial.byteLength)

    const second = right(
      decodeStdioFrames(appendFrameBytes(first.rest, frame.slice(-2))),
    )
    expect(second.messages).toEqual(['{"id":2}'])
    expect(second.rest.byteLength).toBe(0)
  })

  it('decodes multiple frames from one buffer', () => {
    const input = appendFrameBytes(
      encodeStdioFrame('{"id":1}'),
      encodeStdioFrame('{"id":2}'),
    )
    const decoded = right(decodeStdioFrames(input))
    expect(decoded.messages).toEqual(['{"id":1}', '{"id":2}'])
  })

  it('rejects malformed Content-Length headers', () => {
    const decoded = decodeStdioFrames(
      bytes.encode('Content-Length: nope\r\n\r\n{}'),
    )
    expect(Either.isLeft(decoded)).toBe(true)
  })
})
