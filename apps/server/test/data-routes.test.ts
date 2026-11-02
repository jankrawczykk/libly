import { describe, expect, test, vi } from 'vitest'
import { createServer } from '../src/app.js'
import { loadServerConfig } from '../src/config.js'
import { DemoAdapter } from '../src/librus/demo-adapter.js'
import type { LibrusPort } from '../src/librus/librus-port.js'
import {
  SESSION_DATA_CACHE_TTL_MS,
  SessionDataCache,
} from '../src/librus/session-data-cache.js'
import { SESSION_COOKIE_NAME } from '../src/session/session-cookie.js'
import { SessionStore } from '../src/session/session-store.js'

const config = loadServerConfig({})
const requestHeaders = {
  host: '127.0.0.1:3000',
  origin: 'http://127.0.0.1:3000',
}

function quietLogStream() {
  let output = ''
  return {
    write: (message: string): void => {
      output = output.concat(message)
    },
  }
}

function createAuthenticatedServer(
  client: LibrusPort,
  cache: SessionDataCache = new SessionDataCache(),
) {
  const sessions = new SessionStore<LibrusPort>()
  const { id } = sessions.create(client)
  const app = createServer(config, sessions, undefined, quietLogStream(), cache)
  return {
    app,
    headers: {
      ...requestHeaders,
      cookie: `${SESSION_COOKIE_NAME}=${id}`,
    },
  }
}

describe('session data routes', () => {
  test.each([
    ['attendance', '/api/attendance'],
    ['grades', '/api/grades'],
    ['refresh', '/api/refresh'],
  ])('requires an authenticated session for %s', async (_name, url) => {
    const app = createServer(config, undefined, undefined, quietLogStream())
    const response = await app.inject({
      method: url === '/api/refresh' ? 'POST' : 'GET',
      url,
      headers:
        url === '/api/refresh' ? requestHeaders : { host: requestHeaders.host },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required.',
    })
    await app.close()
  })

  test('serves validated attendance and grades from one cached source load', async () => {
    const client = new DemoAdapter()
    const expectedAttendance = await client.getAttendance()
    const expectedGrades = await client.getGrades()
    const calls: string[] = []
    const dataSource: LibrusPort = {
      getAttendance: () => {
        calls.push('attendance')
        return client.getAttendance()
      },
      getGrades: () => {
        calls.push('grades')
        return client.getGrades()
      },
    }
    const { app, headers } = createAuthenticatedServer(dataSource)

    const [attendanceResponse, gradesResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/attendance',
        headers,
      }),
      app.inject({
        method: 'GET',
        url: '/api/grades',
        headers,
      }),
    ])

    expect(attendanceResponse.statusCode).toBe(200)
    expect(attendanceResponse.json()).toEqual(expectedAttendance)
    expect(gradesResponse.statusCode).toBe(200)
    expect(gradesResponse.json()).toEqual(expectedGrades)
    expect(calls).toEqual(['attendance', 'grades'])
    expect(attendanceResponse.headers['cache-control']).toBe('no-store')
    await app.close()
  })

  test('revalidates cached data after its TTL expires', async () => {
    let now = 0
    const client = new DemoAdapter()
    const getAttendance = vi.spyOn(client, 'getAttendance')
    const { app, headers } = createAuthenticatedServer(
      client,
      new SessionDataCache({
        ttlMs: SESSION_DATA_CACHE_TTL_MS,
        now: () => now,
      }),
    )

    await app.inject({ method: 'GET', url: '/api/attendance', headers })
    now += SESSION_DATA_CACHE_TTL_MS
    await app.inject({ method: 'GET', url: '/api/attendance', headers })

    expect(getAttendance).toHaveBeenCalledTimes(2)
    await app.close()
  })

  test('refreshes manually and enforces a sixty-second cooldown', async () => {
    let now = 0
    const client = new DemoAdapter()
    const getAttendance = vi.spyOn(client, 'getAttendance')
    const getGrades = vi.spyOn(client, 'getGrades')
    const cache = new SessionDataCache({ now: () => now })
    const { app, headers } = createAuthenticatedServer(client, cache)

    const initialData = await app.inject({
      method: 'GET',
      url: '/api/attendance',
      headers,
    })
    expect(initialData.statusCode).toBe(200)

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/refresh',
      headers,
    })
    expect(refresh.statusCode).toBe(200)
    expect(refresh.json()).toEqual({ refreshed: true })
    expect(getAttendance).toHaveBeenCalledTimes(2)
    expect(getGrades).toHaveBeenCalledTimes(2)

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/refresh',
      headers,
    })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.headers['retry-after']).toBe('60')
    expect(blocked.json()).toEqual({
      code: 'REFRESH_RATE_LIMITED',
      message: 'Refresh is temporarily unavailable. Try again later.',
    })
    expect(getAttendance).toHaveBeenCalledTimes(2)

    now += 60_000
    const afterCooldown = await app.inject({
      method: 'POST',
      url: '/api/refresh',
      headers,
    })
    expect(afterCooldown.statusCode).toBe(200)
    expect(getAttendance).toHaveBeenCalledTimes(3)
    await app.close()
  })

  test('rejects invalid adapter data without returning or caching it', async () => {
    const client: LibrusPort = {
      getAttendance: () =>
        Promise.resolve([
          {
            date: 'not-a-date',
            lessonNumber: 1,
            subject: 'Synthetic subject',
            kind: 'present',
            rawSymbol: 'synthetic_present',
            semester: 1,
          },
        ]),
      getGrades: () => Promise.resolve([]),
    }
    const getAttendance = vi.spyOn(client, 'getAttendance')
    const { app, headers } = createAuthenticatedServer(client)

    const response = await app.inject({
      method: 'GET',
      url: '/api/attendance',
      headers,
    })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Request failed.',
    })
    expect(response.body).not.toContain('not-a-date')
    expect(getAttendance).toHaveBeenCalledTimes(1)

    const retry = await app.inject({
      method: 'GET',
      url: '/api/attendance',
      headers,
    })
    expect(retry.statusCode).toBe(502)
    expect(retry.body).not.toContain('not-a-date')
    expect(getAttendance).toHaveBeenCalledTimes(2)
    await app.close()
  })
})
