import { randomBytes } from 'node:crypto'

export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000
export const SESSION_ABSOLUTE_TIMEOUT_MS = 60 * 60 * 1000

export interface SessionStoreOptions {
  idleTimeoutMs?: number
  absoluteTimeoutMs?: number
  now?: () => number
}

export interface Session<T> {
  client: T
  createdAt: number
  lastActivityAt: number
  absoluteExpiresAt: number
}

interface StoredSession<T> extends Session<T> {
  idleExpiresAt: number
}

export class SessionStore<T> {
  private readonly sessions = new Map<string, StoredSession<T>>()
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>()
  private readonly idleTimeoutMs: number
  private readonly absoluteTimeoutMs: number
  private readonly now: () => number

  constructor(options: SessionStoreOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? SESSION_IDLE_TIMEOUT_MS
    this.absoluteTimeoutMs =
      options.absoluteTimeoutMs ?? SESSION_ABSOLUTE_TIMEOUT_MS
    this.now = options.now ?? Date.now

    if (!Number.isSafeInteger(this.idleTimeoutMs) || this.idleTimeoutMs <= 0) {
      throw new RangeError('Idle session timeout must be a positive integer.')
    }

    if (
      !Number.isSafeInteger(this.absoluteTimeoutMs) ||
      this.absoluteTimeoutMs <= 0
    ) {
      throw new RangeError(
        'Absolute session timeout must be a positive integer.',
      )
    }
  }

  create(client: T): { id: string; session: Session<T> } {
    const now = this.now()
    this.pruneExpired(now)

    let id = randomBytes(32).toString('base64url')
    while (this.sessions.has(id)) {
      id = randomBytes(32).toString('base64url')
    }

    const session: StoredSession<T> = {
      client,
      createdAt: now,
      lastActivityAt: now,
      idleExpiresAt: now + this.idleTimeoutMs,
      absoluteExpiresAt: now + this.absoluteTimeoutMs,
    }
    this.sessions.set(id, session)
    this.scheduleExpiry(id, session, now)

    return { id, session: this.toPublicSession(session) }
  }

  get(id: string): Session<T> | undefined {
    const session = this.sessions.get(id)
    if (session === undefined) {
      return undefined
    }

    const now = this.now()
    if (now >= session.idleExpiresAt || now >= session.absoluteExpiresAt) {
      this.sessions.delete(id)
      return undefined
    }

    session.lastActivityAt = now
    session.idleExpiresAt = now + this.idleTimeoutMs
    this.scheduleExpiry(id, session, now)
    return this.toPublicSession(session)
  }

  destroy(id: string): boolean {
    const timer = this.expiryTimers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      this.expiryTimers.delete(id)
    }

    return this.sessions.delete(id)
  }

  get size(): number {
    this.pruneExpired(this.now())
    return this.sessions.size
  }

  private pruneExpired(now: number): void {
    for (const [id, session] of this.sessions) {
      if (now >= session.idleExpiresAt || now >= session.absoluteExpiresAt) {
        this.destroy(id)
      }
    }
  }

  private scheduleExpiry(
    id: string,
    session: StoredSession<T>,
    now: number,
  ): void {
    const previousTimer = this.expiryTimers.get(id)
    if (previousTimer !== undefined) {
      clearTimeout(previousTimer)
    }

    const expiresAt = Math.min(session.idleExpiresAt, session.absoluteExpiresAt)
    const timer = setTimeout(
      () => {
        const currentSession = this.sessions.get(id)
        if (currentSession !== session) {
          return
        }

        const currentTime = this.now()
        if (
          currentTime >= session.idleExpiresAt ||
          currentTime >= session.absoluteExpiresAt
        ) {
          this.destroy(id)
          return
        }

        this.scheduleExpiry(id, session, currentTime)
      },
      Math.max(0, expiresAt - now),
    )

    timer.unref()
    this.expiryTimers.set(id, timer)
  }

  private toPublicSession(session: StoredSession<T>): Session<T> {
    return {
      client: session.client,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    }
  }
}
