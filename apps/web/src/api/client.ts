import {
  AttendanceEntrySchema,
  GradeSchema,
  type AttendanceEntry,
  type Grade,
} from '@libly/core'
import { z } from 'zod'
import { t } from '../i18n/index.js'

const SessionStateSchema = z
  .object({
    authenticated: z.boolean(),
  })
  .strict()

const DemoSessionResponseSchema = z
  .object({
    authenticated: z.literal(true),
  })
  .strict()

const RefreshResponseSchema = z
  .object({
    refreshed: z.literal(true),
  })
  .strict()

const ApiErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict()

export type SessionState = z.infer<typeof SessionStateSchema>

export class ApiClientError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor(code: string, statusCode: number, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.statusCode = statusCode
  }
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'INVALID_RESPONSE':
      return t('api.invalidResponse')
    case 'UNAUTHENTICATED':
      return t('api.unauthenticated')
    case 'LOGIN_RATE_LIMITED':
      return t('api.loginRateLimited')
    case 'REFRESH_RATE_LIMITED':
      return t('api.refreshRateLimited')
    default:
      return t('api.requestFailed')
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new ApiClientError(
      'INVALID_RESPONSE',
      response.status,
      getErrorMessage('INVALID_RESPONSE'),
    )
  }
}

async function assertResponseOk(response: Response): Promise<void> {
  if (response.ok) {
    return
  }

  const body = ApiErrorSchema.safeParse(await readJson(response))
  if (body.success) {
    throw new ApiClientError(
      body.data.code,
      response.status,
      getErrorMessage(body.data.code),
    )
  }

  throw new ApiClientError(
    'REQUEST_FAILED',
    response.status,
    getErrorMessage('REQUEST_FAILED'),
  )
}

export function createApiClient(fetcher: typeof fetch = fetch) {
  async function requestJson<T>(
    path: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('Accept', 'application/json')
    if (init?.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetcher(path, {
      ...init,
      cache: 'no-store',
      credentials: 'same-origin',
      headers,
    })
    await assertResponseOk(response)

    const result = schema.safeParse(await readJson(response))
    if (!result.success) {
      throw new ApiClientError(
        'INVALID_RESPONSE',
        response.status,
        getErrorMessage('INVALID_RESPONSE'),
      )
    }

    return result.data
  }

  async function requestNoContent(
    path: string,
    init?: RequestInit,
  ): Promise<void> {
    const headers = new Headers(init?.headers)
    headers.set('Accept', 'application/json')

    const response = await fetcher(path, {
      ...init,
      cache: 'no-store',
      credentials: 'same-origin',
      headers,
    })
    await assertResponseOk(response)

    if (response.status !== 204) {
      throw new ApiClientError(
        'INVALID_RESPONSE',
        response.status,
        getErrorMessage('INVALID_RESPONSE'),
      )
    }
  }

  return {
    getSession: (): Promise<SessionState> =>
      requestJson('/api/session', SessionStateSchema),
    createDemoSession: (): Promise<{ authenticated: true }> =>
      requestJson('/api/session', DemoSessionResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ demo: true }),
      }),
    logout: (): Promise<void> =>
      requestNoContent('/api/session', { method: 'DELETE' }),
    getAttendance: (): Promise<AttendanceEntry[]> =>
      requestJson('/api/attendance', AttendanceEntrySchema.array()),
    getGrades: (): Promise<Grade[]> =>
      requestJson('/api/grades', GradeSchema.array()),
    refresh: (): Promise<{ refreshed: true }> =>
      requestJson('/api/refresh', RefreshResponseSchema, { method: 'POST' }),
  }
}

export const apiClient = createApiClient()
