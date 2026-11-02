import { fastify, type FastifyInstance } from 'fastify'
import { loadServerConfig, type ServerConfig } from './config.js'
import { registerSecurityMiddleware } from './security/security-middleware.js'

export function createServer(
  config: ServerConfig = loadServerConfig(),
): FastifyInstance {
  const app = fastify({ logger: false })
  registerSecurityMiddleware(app, config)
  return app
}
