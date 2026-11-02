import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createServer } from '../src/app.js'
import { loadServerConfig } from '../src/config.js'
import { DemoAdapter } from '../src/librus/demo-adapter.js'
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
} from '../src/session/session-cookie.js'
import { SessionStore } from '../src/session/session-store.js'

const config = loadServerConfig({})
const requestHeaders = {
  host: '127.0.0.1:3000',
  origin: 'http://127.0.0.1:3000',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('session routes', () => {
  test('creates a synthetic demo session for the strict demo request', async () => {
    vi.useRealTimers()
    const sessions = new SessionStore<unknown>()
    const app = createServer(config, sessions)

    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: requestHeaders,
      payload: { demo: true },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({ authenticated: true })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['set-cookie']).toContain('HttpOnly')
    expect(response.headers['set-cookie']).toContain('SameSite=Strict')
    expect(sessions.size).toBe(1)

    const setCookie = response.headers['set-cookie']
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
    expect(cookie).toBeTypeOf('string')
    const sessionId = cookie?.match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`),
    )?.[1]
    if (sessionId === undefined) {
      throw new Error('Expected the demo response to set a session cookie.')
    }

    const client = sessions.get(sessionId)?.client
    expect(client).toBeInstanceOf(DemoAdapter)

    if (!(client instanceof DemoAdapter)) {
      throw new Error('Expected the demo session to contain a DemoAdapter.')
    }

    const attendance = await client.getAttendance()
    const grades = await client.getGrades()
    expect(attendance.length).toBeGreaterThan(0)
    expect(
      attendance.every((entry) => entry.rawSymbol.startsWith('synthetic_')),
    ).toBe(true)
    expect(grades.length).toBeGreaterThan(0)
    await app.close()
  })

  test.each([undefined, { demo: false }, { demo: true, unexpected: true }])(
    'rejects unsupported demo session request bodies: %s',
    async (payload) => {
      vi.useRealTimers()
      const sessions = new SessionStore<unknown>()
      const app = createServer(config, sessions)

      const response = await app.inject({
        method: 'POST',
        url: '/api/session',
        headers: requestHeaders,
        ...(payload === undefined ? {} : { payload }),
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        code: 'INVALID_SESSION_REQUEST',
        message: 'Invalid session request.',
      })
      expect(sessions.size).toBe(0)
      await app.close()
    },
  )

  test('reports unauthenticated and expires an invalid session cookie', async () => {
    const app = createServer(config)

    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        host: requestHeaders.host,
        cookie: `${SESSION_COOKIE_NAME}=invalid`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ authenticated: false })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['set-cookie']).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(response.headers['set-cookie']).toContain(
      `Path=${SESSION_COOKIE_PATH}`,
    )
    await app.close()
  })

  test('sets strict httpOnly cookie attributes for an active session', async () => {
    const sessions = new SessionStore<unknown>()
    const { id } = sessions.create({ synthetic: true })
    const app = createServer(config, sessions)

    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        host: requestHeaders.host,
        cookie: `${SESSION_COOKIE_NAME}=${id}`,
      },
    })

    const setCookie = response.headers['set-cookie']
    expect(response.json()).toEqual({ authenticated: true })
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=${id}`)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=3600')
    expect(setCookie).not.toContain('Domain=')
    expect(setCookie).not.toContain('Secure')
    await app.close()
  })

  test('refreshes the cookie lifetime without extending the absolute session lifetime', async () => {
    const sessions = new SessionStore<unknown>()
    const { id } = sessions.create({ synthetic: true })
    vi.advanceTimersByTime(14 * 60 * 1000)
    const app = createServer(config, sessions)

    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        host: requestHeaders.host,
        cookie: `${SESSION_COOKIE_NAME}=${id}`,
      },
    })

    expect(response.json()).toEqual({ authenticated: true })
    expect(response.headers['set-cookie']).toContain('Max-Age=2760')
    await app.close()
  })

  test('clears the cookie when an idle session expires', async () => {
    const sessions = new SessionStore<unknown>({
      idleTimeoutMs: 1_000,
    })
    const { id } = sessions.create({ synthetic: true })
    vi.advanceTimersByTime(1_000)
    const app = createServer(config, sessions)

    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        host: requestHeaders.host,
        cookie: `${SESSION_COOKIE_NAME}=${id}`,
      },
    })

    expect(response.json()).toEqual({ authenticated: false })
    expect(response.headers['set-cookie']).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(sessions.get(id)).toBeUndefined()
    await app.close()
  })

  test('destroys the session and expires the cookie on logout', async () => {
    const sessions = new SessionStore<unknown>()
    const { id } = sessions.create({ synthetic: true })
    const app = createServer(config, sessions)

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/session',
      headers: {
        ...requestHeaders,
        cookie: `${SESSION_COOKIE_NAME}=${id}`,
      },
    })

    expect(response.statusCode).toBe(204)
    expect(sessions.get(id)).toBeUndefined()
    expect(response.headers['set-cookie']).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(response.headers['cache-control']).toBe('no-store')
    await app.close()
  })
})
