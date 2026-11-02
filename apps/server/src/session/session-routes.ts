import type { FastifyInstance } from 'fastify'
import {
  clearSessionCookie,
  readSessionId,
  setSessionCookie,
} from './session-cookie.js'
import type { SessionStore } from './session-store.js'

export function registerSessionRoutes(
  app: FastifyInstance,
  sessions: SessionStore<unknown>,
): void {
  app.get('/api/session', async (request, reply) => {
    const sessionId = readSessionId(request)
    if (sessionId === undefined) {
      clearSessionCookie(reply)
      return { authenticated: false }
    }

    const session = sessions.get(sessionId)

    if (session === undefined) {
      clearSessionCookie(reply)
      return { authenticated: false }
    }

    setSessionCookie(reply, sessionId, session.absoluteExpiresAt)
    return { authenticated: true }
  })

  app.delete('/api/session', async (request, reply) => {
    const sessionId = readSessionId(request)
    if (sessionId !== undefined) {
      sessions.destroy(sessionId)
    }

    clearSessionCookie(reply)
    return reply.code(204).send()
  })
}
