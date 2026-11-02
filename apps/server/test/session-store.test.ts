import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SessionStore,
} from '../src/session/session-store.js'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SessionStore', () => {
  test('generates a random base64url session id and stores only the client value', () => {
    const now = Date.now()
    const store = new SessionStore<unknown>({ now: () => now })
    const client = { marker: 'synthetic-client' }
    const created = store.create(client)

    expect(created.id).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(created.session.client).toBe(client)
    expect(created.session.createdAt).toBe(now)
    expect(created.session.lastActivityAt).toBe(now)
    expect(created.session.absoluteExpiresAt).toBe(
      created.session.createdAt + SESSION_ABSOLUTE_TIMEOUT_MS,
    )
    expect(store.get(created.id)?.client).toBe(client)
  })

  test('expires an idle session at the timeout boundary', () => {
    const store = new SessionStore<object>()
    const { id } = store.create({})

    vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS - 1)
    expect(store.get(id)).toBeDefined()

    vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS)
    expect(vi.getTimerCount()).toBe(0)
    expect(store.get(id)).toBeUndefined()
    expect(store.size).toBe(0)
  })

  test('activity refreshes idle expiry without extending absolute expiry', () => {
    const store = new SessionStore<object>({
      idleTimeoutMs: 10 * 60 * 1000,
      absoluteTimeoutMs: 60 * 60 * 1000,
    })
    const { id, session: initial } = store.create({})

    vi.advanceTimersByTime(9 * 60 * 1000)
    expect(store.get(id)?.lastActivityAt).toBe(Date.now())

    vi.advanceTimersByTime(9 * 60 * 1000)
    expect(store.get(id)?.absoluteExpiresAt).toBe(initial.absoluteExpiresAt)

    vi.setSystemTime(initial.absoluteExpiresAt)
    expect(store.get(id)).toBeUndefined()
  })

  test('removes a session when its absolute timeout is reached', () => {
    const store = new SessionStore<object>({
      idleTimeoutMs: 90 * 60 * 1000,
      absoluteTimeoutMs: 60 * 60 * 1000,
    })
    const { id } = store.create({})

    vi.advanceTimersByTime(60 * 60 * 1000)

    expect(vi.getTimerCount()).toBe(0)
    expect(store.get(id)).toBeUndefined()
  })

  test('destroys a session immediately and treats unknown ids as absent', () => {
    const store = new SessionStore<object>()
    const { id } = store.create({})

    expect(store.destroy(id)).toBe(true)
    expect(store.destroy(id)).toBe(false)
    expect(store.get(id)).toBeUndefined()
  })

  test('rejects invalid session timeout configuration', () => {
    expect(() => new SessionStore({ idleTimeoutMs: 0 })).toThrow(RangeError)
    expect(() => new SessionStore({ absoluteTimeoutMs: Number.NaN })).toThrow(
      RangeError,
    )
  })

  test('prunes expired sessions when creating a new session', () => {
    const store = new SessionStore<object>({ idleTimeoutMs: 1_000 })
    const { id } = store.create({})

    vi.advanceTimersByTime(1_000)
    store.create({})

    expect(store.get(id)).toBeUndefined()
    expect(store.size).toBe(1)
  })
})
