export const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const parseJson = (text) => (text === '' ? undefined : JSON.parse(text))

const headersFor = (body, token) => ({
  ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
})

export const request = async (
  baseUrl,
  method,
  path,
  body,
  token,
  expected = [200],
) => {
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    method,
    headers: headersFor(body, token),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  const payload = parseJson(text)

  if (!expected.includes(response.status)) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`,
    )
  }

  return { status: response.status, payload }
}

export const requestAny = async (baseUrl, method, path, body, token) => {
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    method,
    headers: headersFor(body, token),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, payload: parseJson(text), text }
}

export const expectPayload = async (...args) => {
  const result = await request(...args)
  return result.payload
}

export const optionValue = (option) =>
  option?._tag === 'Some' ? option.value : undefined
