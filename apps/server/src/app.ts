import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { fastify, type FastifyInstance } from 'fastify'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadServerConfig, type ServerConfig } from './config.js'
import { LoginAttemptLimiter } from './security/login-attempt-limiter.js'
import { registerSecurityMiddleware } from './security/security-middleware.js'
import { registerSessionRoutes } from './session/session-routes.js'
import { SessionStore } from './session/session-store.js'
import { z } from 'zod'
import type { LibrusPort } from './librus/librus-port.js'
import { registerDataRoutes } from './librus/data-routes.js'
import { SessionDataCache } from './librus/session-data-cache.js'

interface ServerLogStream {
  write(message: string): void
}

export interface ServerOptions {
  serveWeb?: boolean
}

export const SERVER_LOG_REDACTION_PATHS = [
  'password',
  '*.password',
  'req.body.password',
  'cookie',
  '*.cookie',
  "req.headers['cookie']",
  "res.headers['set-cookie']",
  'authorization',
  '*.authorization',
  "req.headers['authorization']",
  'err.message',
  'err.stack',
] as const

const WEB_DIST_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/dist',
)

export function createServer(
  config: ServerConfig = loadServerConfig(),
  sessions: SessionStore<LibrusPort> = new SessionStore<LibrusPort>(),
  loginAttempts: LoginAttemptLimiter = new LoginAttemptLimiter(),
  logStream?: ServerLogStream,
  sessionDataCache: SessionDataCache = new SessionDataCache(),
  options: ServerOptions = {},
): FastifyInstance {
  const app = fastify({
    logger: {
      level: 'info',
      redact: {
        paths: [...SERVER_LOG_REDACTION_PATHS],
        censor: '[REDACTED]',
      },
      serializers: {
        req: (request) => ({
          method: request.method,
          remoteAddress: request.ip,
        }),
      },
      ...(logStream === undefined ? {} : { stream: logStream }),
    },
  })
  app.setErrorHandler((error: unknown, request, reply) => {
    const statusResult = z
      .object({
        statusCode: z.number().int().min(400).max(599),
      })
      .safeParse(error)
    const statusCode = statusResult.success ? statusResult.data.statusCode : 500

    request.log.error({ statusCode }, 'Request failed')
    return reply.code(statusCode).send({
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
      message: statusCode >= 500 ? 'Request failed.' : 'Invalid request.',
    })
  })
  app.register(cookie)
  registerSecurityMiddleware(app, config)
  if (options.serveWeb && existsSync(WEB_DIST_DIRECTORY)) {
    app.register(fastifyStatic, {
      root: WEB_DIST_DIRECTORY,
      wildcard: false,
    })
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html')
      }

      return reply.code(404).send({
        code: 'NOT_FOUND',
        message: 'Not found.',
      })
    })
  }
  registerSessionRoutes(app, sessions, loginAttempts)
  registerDataRoutes(app, sessions, sessionDataCache)
  return app
}
