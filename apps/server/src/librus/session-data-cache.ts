import {
  AttendanceEntrySchema,
  GradeSchema,
  type AttendanceEntry,
  type Grade,
} from '@libly/core'
import type { LibrusPort } from './librus-port.js'

export const SESSION_DATA_CACHE_TTL_MS = 3 * 60 * 1000
export const DATA_REFRESH_COOLDOWN_MS = 60 * 1000

export interface SessionDataSnapshot {
  attendance: readonly AttendanceEntry[]
  grades: readonly Grade[]
}

export interface SessionDataCacheOptions {
  ttlMs?: number
  refreshCooldownMs?: number
  now?: () => number
}

interface CacheEntry {
  data?: SessionDataSnapshot
  cachedAt?: number
  lastRefreshAt?: number
  inFlight?: Promise<SessionDataSnapshot>
  operationQueue: Promise<void>
}

export class InvalidSessionDataError extends Error {
  readonly statusCode = 502

  constructor() {
    super('Session data failed validation.')
    this.name = 'InvalidSessionDataError'
  }
}

export class DataRefreshCooldownError extends Error {
  readonly statusCode = 429
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super('Manual refresh is temporarily unavailable.')
    this.name = 'DataRefreshCooldownError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class SessionDataCache {
  private readonly entries = new WeakMap<LibrusPort, CacheEntry>()
  private readonly ttlMs: number
  private readonly refreshCooldownMs: number
  private readonly now: () => number

  constructor(options: SessionDataCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? SESSION_DATA_CACHE_TTL_MS
    this.refreshCooldownMs =
      options.refreshCooldownMs ?? DATA_REFRESH_COOLDOWN_MS
    this.now = options.now ?? Date.now

    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs <= 0) {
      throw new RangeError('Session data cache TTL must be a positive integer.')
    }

    if (
      !Number.isSafeInteger(this.refreshCooldownMs) ||
      this.refreshCooldownMs <= 0
    ) {
      throw new RangeError('Refresh cooldown must be a positive integer.')
    }
  }

  async get(client: LibrusPort): Promise<SessionDataSnapshot> {
    const entry = this.getEntry(client)
    if (
      entry.data !== undefined &&
      entry.cachedAt !== undefined &&
      this.now() - entry.cachedAt < this.ttlMs
    ) {
      return this.cloneSnapshot(entry.data)
    }

    if (entry.inFlight !== undefined) {
      return this.cloneSnapshot(await entry.inFlight)
    }

    return this.cloneSnapshot(await this.scheduleLoad(client, entry))
  }

  async refresh(client: LibrusPort): Promise<void> {
    const entry = this.getEntry(client)
    const now = this.now()
    if (entry.lastRefreshAt !== undefined) {
      const remainingMs = entry.lastRefreshAt + this.refreshCooldownMs - now
      if (remainingMs > 0) {
        throw new DataRefreshCooldownError(Math.ceil(remainingMs / 1000))
      }
    }

    entry.lastRefreshAt = now
    await this.scheduleLoad(client, entry)
  }

  private getEntry(client: LibrusPort): CacheEntry {
    let entry = this.entries.get(client)
    if (entry === undefined) {
      entry = { operationQueue: Promise.resolve() }
      this.entries.set(client, entry)
    }
    return entry
  }

  private scheduleLoad(
    client: LibrusPort,
    entry: CacheEntry,
  ): Promise<SessionDataSnapshot> {
    const operation = entry.operationQueue.then(async () => {
      const data = await this.loadSnapshot(client)
      entry.data = data
      entry.cachedAt = this.now()
      return data
    })
    entry.operationQueue = operation.then(
      () => undefined,
      () => undefined,
    )
    entry.inFlight = operation
    void operation.then(
      () => {
        this.clearInFlight(entry, operation)
      },
      () => {
        this.clearInFlight(entry, operation)
      },
    )
    return operation
  }

  private clearInFlight(
    entry: CacheEntry,
    operation: Promise<SessionDataSnapshot>,
  ): void {
    if (entry.inFlight === operation) {
      delete entry.inFlight
    }
  }

  private async loadSnapshot(client: LibrusPort): Promise<SessionDataSnapshot> {
    const attendanceResult = AttendanceEntrySchema.array().safeParse(
      await client.getAttendance(),
    )
    if (!attendanceResult.success) {
      throw new InvalidSessionDataError()
    }

    const gradesResult = GradeSchema.array().safeParse(await client.getGrades())
    if (!gradesResult.success) {
      throw new InvalidSessionDataError()
    }

    return {
      attendance: attendanceResult.data,
      grades: gradesResult.data,
    }
  }

  private cloneSnapshot(data: SessionDataSnapshot): SessionDataSnapshot {
    return {
      attendance: data.attendance.map((entry) => ({ ...entry })),
      grades: data.grades.map((grade) => ({ ...grade })),
    }
  }
}
