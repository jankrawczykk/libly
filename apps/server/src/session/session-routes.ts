import type { FastifyInstance } from 'fastify'
import {
  clearSessionCookie,
  readSessionId,
  setSessionCookie,
} from './session-cookie.js'
import { DemoAdapter } from '../librus/demo-adapter.js'
import type { SessionStore } from './session-store.js'
import { z } from 'zod'

const DemoSessionRequestSchema = z
  .object({
    demo: z.literal(true),
  })
  .strict()

export function registerSessionRoutes(
  app: FastifyInstance,
  sessions: SessionStore<unknown>,
): void {
  app.post('/api/session', async (request, reply) => {
    if (!DemoSessionRequestSchema.safeParse(request.body).success) {
      return reply.code(400).send({
        code: 'INVALID_SESSION_REQUEST',
        message: 'Invalid session request.',
      })
    }

    const { id, session } = sessions.create(new DemoAdapter())
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
