import helmet from '@fastify/helmet'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ServerConfig } from '../config.js'

const HostHeaderSchema = z
  .string()
  .regex(/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i)
  .transform((value) => {
    const portSeparator = value.lastIndexOf(':')
    const hostname =
      portSeparator === -1
        ? value.toLowerCase()
        : value.slice(0, portSeparator).toLowerCase()
    const port =
      portSeparator === -1 ? 80 : Number(value.slice(portSeparator + 1))

    return { hostname, port }
  })
  .refine(({ port }) => port >= 1 && port <= 65535)

const OriginHeaderSchema = z
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) {
      return false
    }

    const origin = new URL(value)

    return (
      origin.protocol === 'http:' &&
      origin.pathname === '/' &&
      origin.search === '' &&
      origin.hash === '' &&
      origin.username === '' &&
      origin.password === ''
    )
  })
  .transform((value) => new URL(value))

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isApiRequest(url: string): boolean {
  const pathname = url.split('?', 1)[0] ?? ''
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function registerSecurityMiddleware(
  app: FastifyInstance,
  config: ServerConfig,
): void {
  let expectedPort = config.port

  app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'base-uri': ["'none'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: false,
    xContentTypeOptions: true,
  })

  app.addHook('onListen', (done) => {
    const address = app.server.address()
    if (address !== null && typeof address !== 'string') {
      expectedPort = address.port
    }

    done()
  })

  app.addHook('onRequest', (request, reply, done) => {
    const apiRequest = isApiRequest(request.url)

    if (apiRequest) {
      reply.header('Cache-Control', 'no-store')
    }

    const hostResult = HostHeaderSchema.safeParse(request.headers.host)
    if (!hostResult.success || hostResult.data.port !== expectedPort) {
      reply.code(403).send({
        code: 'REQUEST_REJECTED',
        message: 'Request rejected.',
      })
      return
    }

    if (!STATE_CHANGING_METHODS.has(request.method)) {
      done()
      return
    }

    const originResult = OriginHeaderSchema.safeParse(request.headers.origin)
    const expectedOrigin = `http://${hostResult.data.hostname}:${String(expectedPort)}`

    if (
      !originResult.success ||
      originResult.data.origin !== new URL(expectedOrigin).origin
    ) {
      reply.code(403).send({
        code: 'REQUEST_REJECTED',
        message: 'Request rejected.',
      })
      return
    }

    done()
  })

  app.addHook('onSend', (request, reply, payload, done) => {
    if (isApiRequest(request.url)) {
      reply.header('Cache-Control', 'no-store')
    }

    done(null, payload)
  })
}
