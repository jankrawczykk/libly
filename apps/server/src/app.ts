import cookie from '@fastify/cookie'
import { fastify, type FastifyInstance } from 'fastify'
import { loadServerConfig, type ServerConfig } from './config.js'
import { registerSecurityMiddleware } from './security/security-middleware.js'
import { registerSessionRoutes } from './session/session-routes.js'
import { SessionStore } from './session/session-store.js'

export function createServer(
  config: ServerConfig = loadServerConfig(),
  sessions: SessionStore<unknown> = new SessionStore<unknown>(),
): FastifyInstance {
  const app = fastify({ logger: false })
  app.register(cookie)
  registerSecurityMiddleware(app, config)
  registerSessionRoutes(app, sessions)
  return app
}
