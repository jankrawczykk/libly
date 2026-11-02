import type { FastifyInstance } from 'fastify'
import {
  clearSessionCookie,
  readSessionId,
  setSessionCookie,
} from './session-cookie.js'
import { DemoAdapter } from '../librus/demo-adapter.js'
import { LoginAttemptLimiter } from '../security/login-attempt-limiter.js'
import type { SessionStore } from './session-store.js'
import { z } from 'zod'
import type { LibrusPort } from '../librus/librus-port.js'

const DemoSessionRequestSchema = z
  .object({
    demo: z.literal(true),
  })
  .strict()

export function registerSessionRoutes(
  app: FastifyInstance,
  sessions: SessionStore<LibrusPort>,
  loginAttempts: LoginAttemptLimiter = new LoginAttemptLimiter(),
): void {
  app.post('/api/session', async (request, reply) => {
    const retryAfterSeconds = loginAttempts.getRetryAfterSeconds(request.ip)
    if (retryAfterSeconds !== undefined) {
      reply.header('Retry-After', retryAfterSeconds)
      return reply.code(429).send({
        code: 'LOGIN_RATE_LIMITED',
        message: 'Too many failed session attempts. Try again later.',
      })
    }

    if (!DemoSessionRequestSchema.safeParse(request.body).success) {
      loginAttempts.recordFailure(request.ip)
      return reply.code(400).send({
        code: 'INVALID_SESSION_REQUEST',
        message: 'Invalid session request.',
      })
    }

    const { id, session } = sessions.create(new DemoAdapter())
    loginAttempts.recordSuccess(request.ip)
    setSessionCookie(reply, id, session.absoluteExpiresAt)
    return reply.code(201).send({ authenticated: true })
  })

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
