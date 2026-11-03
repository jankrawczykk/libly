import { existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { createServer } from '../src/app.js'
import { loadServerConfig } from '../src/config.js'

describe.skipIf(
  !existsSync(new URL('../../web/dist/index.html', import.meta.url)),
)('production web serving', () => {
  test('serves the built app and keeps missing API routes as API errors', async () => {
    const app = createServer(
      loadServerConfig({ PORT: '0' }),
      undefined,
      undefined,
      undefined,
      undefined,
      { serveWeb: true },
    )
    await app.listen({ host: '127.0.0.1', port: 0 })

    try {
      const address = app.server.address()
      if (address === null || typeof address === 'string') {
        throw new Error('Expected the server to listen on an IP address')
      }
      const headers = { host: `127.0.0.1:${String(address.port)}` }
      const page = await app.inject({ method: 'GET', url: '/', headers })
      expect(page.statusCode).toBe(200)
      expect(page.headers['content-type']).toContain('text/html')
      expect(page.body).toContain('<div id="root"></div>')

      const missingApi = await app.inject({
        method: 'GET',
        url: '/api/missing',
        headers,
      })
      expect(missingApi.statusCode).toBe(404)
      expect(missingApi.json()).toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await app.close()
    }
  })
})
