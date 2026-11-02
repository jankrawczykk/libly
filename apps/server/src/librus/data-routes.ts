import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { clearSessionCookie, readSessionId } from '../session/session-cookie.js'
import type { SessionStore } from '../session/session-store.js'
import type { LibrusPort } from './librus-port.js'
import {
  DataRefreshCooldownError,
  SessionDataCache,
} from './session-data-cache.js'

function getClient(
  request: FastifyRequest,
  reply: FastifyReply,
  sessions: SessionStore<LibrusPort>,
): LibrusPort | undefined {
  const sessionId = readSessionId(request)
  const session = sessionId === undefined ? undefined : sessions.get(sessionId)
  if (session === undefined) {
    clearSessionCookie(reply)
    reply.code(401).send({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required.',
    })
    return undefined
  }
  return session.client
}

export function registerDataRoutes(
  app: FastifyInstance,
  sessions: SessionStore<LibrusPort>,
  cache: SessionDataCache,
): void {
  app.get('/api/attendance', async (request, reply) => {
    const client = getClient(request, reply, sessions)
    if (client === undefined) {
      return reply
    }

    const data = await cache.get(client)
    return data.attendance
  })

  app.get('/api/grades', async (request, reply) => {
    const client = getClient(request, reply, sessions)
    if (client === undefined) {
      return reply
    }

    const data = await cache.get(client)
    return data.grades
  })

  app.post('/api/refresh', async (request, reply) => {
    const client = getClient(request, reply, sessions)
    if (client === undefined) {
      return reply
    }

    try {
      await cache.refresh(client)
    } catch (error: unknown) {
      if (!(error instanceof DataRefreshCooldownError)) {
        throw error
      }

      reply.header('Retry-After', error.retryAfterSeconds)
      return reply.code(429).send({
        code: 'REFRESH_RATE_LIMITED',
        message: 'Refresh is temporarily unavailable. Try again later.',
      })
    }

    return { refreshed: true }
  })
}
