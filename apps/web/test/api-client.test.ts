import { expect, test } from 'vitest'
import { createApiClient } from '../src/api/client.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('uses same-origin requests and validates session state', async () => {
  const requests: Array<{
    input: RequestInfo | URL
    init: RequestInit | undefined
  }> = []
  const fetcher: typeof fetch = (input, init) => {
    requests.push({ input, init })
    return Promise.resolve(jsonResponse({ authenticated: false }))
  }
  const client = createApiClient(fetcher)

  await expect(client.getSession()).resolves.toEqual({ authenticated: false })
  expect(requests).toHaveLength(1)
  expect(requests[0]?.input).toBe('/api/session')
  expect(requests[0]?.init?.credentials).toBe('same-origin')
  expect(requests[0]?.init?.cache).toBe('no-store')
  expect(requests[0]?.init?.headers).toBeInstanceOf(Headers)
})

test('creates only a demo session with the strict API request shape', async () => {
  let capturedBody: BodyInit | null | undefined
  const fetcher: typeof fetch = (_input, init) => {
    capturedBody = init?.body
    return Promise.resolve(jsonResponse({ authenticated: true }, 201))
  }
  const client = createApiClient(fetcher)

  await expect(client.createDemoSession()).resolves.toEqual({
    authenticated: true,
  })
  expect(capturedBody).toBe(JSON.stringify({ demo: true }))
})

test('validates server records before exposing them to the application', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(
      jsonResponse([
        {
          date: '2026-09-01',
          lessonNumber: 1,
          subject: 'Matematyka',
          kind: 'present',
          rawSymbol: 'synthetic_present',
          semester: 1,
        },
      ]),
    )
  const client = createApiClient(fetcher)

  await expect(client.getAttendance()).resolves.toEqual([
    {
      date: '2026-09-01',
      lessonNumber: 1,
      subject: 'Matematyka',
      kind: 'present',
      rawSymbol: 'synthetic_present',
      semester: 1,
    },
  ])
})

test('validates grade data and handles the no-content logout response', async () => {
  const requests: Array<{
    input: RequestInfo | URL
    init: RequestInit | undefined
  }> = []
  const fetcher: typeof fetch = (input, init) => {
    requests.push({ input, init })
    if (input === '/api/grades') {
      return Promise.resolve(
        jsonResponse([
          {
            subject: 'Matematyka',
            value: 5,
            rawValue: '5',
            weight: 2,
            category: 'Sprawdzian',
            date: '2026-09-01',
            semester: 1,
            countsToAverage: true,
          },
        ]),
      )
    }

    return Promise.resolve(new Response(null, { status: 204 }))
  }
  const client = createApiClient(fetcher)

  await expect(client.getGrades()).resolves.toMatchObject([
    { subject: 'Matematyka', value: 5 },
  ])
  await expect(client.logout()).resolves.toBeUndefined()
  expect(requests.map(({ input, init }) => [input, init?.method])).toEqual([
    ['/api/grades', undefined],
    ['/api/session', 'DELETE'],
  ])
})

test('fails with a typed error when a response violates its schema', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(jsonResponse([{ date: 'not-a-date' }]))
  const client = createApiClient(fetcher)

  await expect(client.getAttendance()).rejects.toMatchObject({
    name: 'ApiClientError',
    code: 'INVALID_RESPONSE',
    statusCode: 200,
  })
})

test('preserves stable API error codes in typed client errors', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(
      jsonResponse(
        {
          code: 'REFRESH_RATE_LIMITED',
          message: 'Refresh is temporarily unavailable. Try again later.',
        },
        429,
      ),
    )
  const client = createApiClient(fetcher)

  await expect(client.refresh()).rejects.toMatchObject({
    name: 'ApiClientError',
    code: 'REFRESH_RATE_LIMITED',
    statusCode: 429,
    message: 'Odświeżanie jest chwilowo niedostępne. Spróbuj ponownie później.',
  })
})
