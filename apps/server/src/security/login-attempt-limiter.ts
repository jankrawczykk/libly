export const LOGIN_ATTEMPT_WINDOW_MS = 60_000
export const LOGIN_ATTEMPTS_PER_WINDOW = 5
export const LOGIN_BASE_BACKOFF_MS = 1_000
export const LOGIN_MAX_BACKOFF_MS = 60_000

interface LoginAttemptState {
  failures: number[]
  consecutiveFailures: number
  blockedUntil: number
  lastFailureAt: number
}

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, LoginAttemptState>()
  private readonly now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  getRetryAfterSeconds(key: string): number | undefined {
    const state = this.attempts.get(key)
    if (state === undefined) {
      return undefined
    }

    const now = this.now()
    if (now - state.lastFailureAt > LOGIN_ATTEMPT_WINDOW_MS) {
      this.attempts.delete(key)
      return undefined
    }

    this.removeExpiredFailures(state, now)

    const backoffRemaining = Math.max(0, state.blockedUntil - now)
    const windowRemaining =
      state.failures.length >= LOGIN_ATTEMPTS_PER_WINDOW
        ? Math.max(
            0,
            (state.failures[0] ?? now) + LOGIN_ATTEMPT_WINDOW_MS - now,
          )
        : 0
    const retryAfterMs = Math.max(backoffRemaining, windowRemaining)

    if (retryAfterMs === 0) {
      return undefined
    }

    return Math.ceil(retryAfterMs / 1_000)
  }

  recordFailure(key: string): void {
    const now = this.now()
    const state = this.attempts.get(key) ?? {
      failures: [],
      consecutiveFailures: 0,
      blockedUntil: 0,
      lastFailureAt: now,
    }
    this.removeExpiredFailures(state, now)

    state.failures.push(now)
    state.consecutiveFailures += 1
    state.lastFailureAt = now
    const backoffMs = Math.min(
      LOGIN_MAX_BACKOFF_MS,
      LOGIN_BASE_BACKOFF_MS * 2 ** (state.consecutiveFailures - 1),
    )
    state.blockedUntil = now + backoffMs
    this.attempts.set(key, state)
  }

  recordSuccess(key: string): void {
    this.attempts.delete(key)
  }

  private removeExpiredFailures(state: LoginAttemptState, now: number): void {
    const windowStart = now - LOGIN_ATTEMPT_WINDOW_MS
    state.failures = state.failures.filter(
      (timestamp) => timestamp > windowStart,
    )
  }
}
