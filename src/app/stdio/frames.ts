/** @Acp.App.Stdio.Frames — Content-Length JSON-RPC frame codec */
import { Data, Either } from 'effect'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const headerDecoder = new TextDecoder('ascii')
const separator = new Uint8Array([13, 10, 13, 10])
const maxHeaderBytes = 8192

type Bytes = Uint8Array

export interface StdioDecodeResult {
  readonly messages: readonly string[]
  readonly rest: Bytes
}

export class StdioFrameError extends Data.TaggedError('StdioFrameError')<{
  readonly message: string
}> {}

const concatBytes = (left: Bytes, right: Bytes): Bytes => {
  const out = new Uint8Array(left.length + right.length)
  out.set(left, 0)
  out.set(right, left.length)
  return out
}

const indexOfSeparator = (bytes: Bytes, from: number): number => {
  for (let i = from; i <= bytes.length - separator.length; i += 1) {
    if (
      bytes[i] === separator[0] &&
      bytes[i + 1] === separator[1] &&
      bytes[i + 2] === separator[2] &&
      bytes[i + 3] === separator[3]
    ) {
      return i
    }
  }
  return -1
}

const contentLength = (
  headerBytes: Bytes,
): Either.Either<number, StdioFrameError> => {
  const header = headerDecoder.decode(headerBytes)
  const line = header
    .split('\r\n')
    .find((part) => part.toLowerCase().startsWith('content-length:'))
  if (line === undefined) {
    return Either.left(
      new StdioFrameError({ message: 'missing Content-Length header' }),
    )
  }
  const raw = line.slice('content-length:'.length).trim()
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? Either.right(parsed)
    : Either.left(
        new StdioFrameError({ message: `invalid Content-Length: ${raw}` }),
      )
}

export const appendFrameBytes = (buffer: Bytes, chunk: Bytes): Bytes =>
  concatBytes(buffer, chunk)

export const encodeStdioFrame = (message: string): Bytes => {
  const body = encoder.encode(message)
  const header = encoder.encode(
    `Content-Length: ${String(body.length)}\r\n\r\n`,
  )
  return concatBytes(header, body)
}

export const decodeStdioFrames = (
  input: Bytes,
): Either.Either<StdioDecodeResult, StdioFrameError> => {
  const messages: string[] = []
  let cursor = 0

  while (cursor < input.length) {
    const headerEnd = indexOfSeparator(input, cursor)
    if (headerEnd < 0) {
      if (input.length - cursor > maxHeaderBytes) {
        return Either.left(
          new StdioFrameError({ message: 'header exceeds maximum length' }),
        )
      }
      return Either.right({ messages, rest: input.slice(cursor) })
    }

    const length = contentLength(input.slice(cursor, headerEnd))
    if (Either.isLeft(length)) {
      return Either.left(length.left)
    }

    const bodyStart = headerEnd + separator.length
    const bodyEnd = bodyStart + length.right
    if (input.length < bodyEnd) {
      return Either.right({ messages, rest: input.slice(cursor) })
    }

    messages.push(decoder.decode(input.slice(bodyStart, bodyEnd)))
    cursor = bodyEnd
  }

  return Either.right({ messages, rest: input.slice(cursor) })
}
