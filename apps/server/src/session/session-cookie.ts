import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

export const SESSION_COOKIE_NAME = 'libly_session'
export const SESSION_COOKIE_PATH = '/'

const SessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

export function readSessionId(request: FastifyRequest): string | undefined {
  const parsed = SessionIdSchema.safeParse(request.cookies[SESSION_COOKIE_NAME])
  return parsed.success ? parsed.data : undefined
}

export function setSessionCookie(
  reply: FastifyReply,
  sessionId: string,
  absoluteExpiresAt: number,
  now: number = Date.now(),
): void {
  const remainingSeconds = Math.ceil((absoluteExpiresAt - now) / 1000)
  if (remainingSeconds <= 0) {
    clearSessionCookie(reply)
    return
  }

  reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    path: SESSION_COOKIE_PATH,
    maxAge: remainingSeconds,
  })
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    path: SESSION_COOKIE_PATH,
  })
}
