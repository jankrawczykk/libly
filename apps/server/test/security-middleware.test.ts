import { describe, expect, test } from 'vitest'
import { createServer } from '../src/app.js'
import { loadServerConfig } from '../src/config.js'

const serverConfig = loadServerConfig({})
const ownHeaders = {
  host: '127.0.0.1:3000',
  origin: 'http://127.0.0.1:3000',
}

describe('security middleware', () => {
  test('sets the required security headers', async () => {
    const app = createServer(serverConfig)
    app.get('/', () => ({ status: 'ok' }))

    const response = await app.inject({
      method: 'GET',
      url: '/',
      headers: { host: ownHeaders.host },
    })

    expect(response.headers['content-security-policy']).toBe(
      "default-src 'self';script-src 'self';style-src 'self';img-src 'self' data:;connect-src 'self';base-uri 'none';form-action 'self';frame-ancestors 'none'",
    )
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin')

    await app.close()
  })

  test.each([
    ['untrusted hostname', 'attacker.example:3000'],
    ['incorrect port', '127.0.0.1:3001'],
    ['missing host', undefined],
  ])('rejects a request with %s', async (_reason, host) => {
    const app = createServer(serverConfig)

    const response = await app.inject({
      method: 'GET',
      url: '/',
      headers: host === undefined ? {} : { host },
    })

    expect(response.statusCode).toBe(403)
    await app.close()
  })

  test.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'rejects %s without a same-origin Origin header',
    async (method) => {
      const app = createServer(serverConfig)

      const response = await app.inject({
        method,
        url: '/api/resource',
        headers: { host: ownHeaders.host },
      })

      expect(response.statusCode).toBe(403)
      expect(response.headers['cache-control']).toBe('no-store')
      await app.close()
    },
  )

  test.each([
    ['foreign origin', 'http://attacker.example:3000'],
    ['origin on another local host', 'http://localhost:3000'],
    ['origin with a path', 'http://127.0.0.1:3000/path'],
    ['malformed origin', 'null'],
  ])('rejects a mutation with %s', async (_reason, origin) => {
    const app = createServer(serverConfig)

    const response = await app.inject({
      method: 'POST',
      url: '/api/resource',
      headers: { host: ownHeaders.host, origin },
    })

    expect(response.statusCode).toBe(403)
    expect(response.headers['cache-control']).toBe('no-store')
    await app.close()
  })

  test('allows requests from the matching local origin and disables API caching', async () => {
    const app = createServer(serverConfig)
    app.post('/api/resource', (_request, reply) => {
      reply.header('Cache-Control', 'public, max-age=3600')
      return { status: 'ok' }
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/resource',
      headers: ownHeaders,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    await app.close()
  })

  test('sets no-store when rejecting an API request for an invalid Host', async () => {
    const app = createServer(serverConfig)

    const response = await app.inject({
      method: 'GET',
      url: '/api/resource',
      headers: { host: 'attacker.example:3000' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.headers['cache-control']).toBe('no-store')
    await app.close()
  })

  test('allows localhost when both Host and Origin use that host', async () => {
    const app = createServer(serverConfig)
    app.post('/api/resource', () => ({ status: 'ok' }))

    const response = await app.inject({
      method: 'POST',
      url: '/api/resource',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    })

    expect(response.statusCode).toBe(200)
    await app.close()
  })

  test('uses the actual port when the server is started on an ephemeral port', async () => {
    const app = createServer(loadServerConfig({ PORT: '0' }))
    app.post('/api/resource', () => ({ status: 'ok' }))
    await app.listen({ host: '127.0.0.1', port: 0 })

    const address = app.server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('Expected the server to listen on an IP address')
    }

    const port = String(address.port)
    const response = await app.inject({
      method: 'POST',
      url: '/api/resource',
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
      },
    })

    expect(response.statusCode).toBe(200)
    await app.close()
  })

  test('sets no-store on API errors and query-string requests', async () => {
    const app = createServer(serverConfig)

    const response = await app.inject({
      method: 'GET',
      url: '/api/missing?include=none',
      headers: { host: ownHeaders.host },
    })

    expect(response.statusCode).toBe(404)
    expect(response.headers['cache-control']).toBe('no-store')
    await app.close()
  })
})
