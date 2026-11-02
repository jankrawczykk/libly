import { fastify, type FastifyInstance } from 'fastify'

export function createServer(): FastifyInstance {
  return fastify({ logger: false })
}
