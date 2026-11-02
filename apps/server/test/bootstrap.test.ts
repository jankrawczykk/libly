import { expect, test } from 'vitest'
import { loadServerConfig } from '../src/config.js'
import { createServer } from '../src/index.js'

test('server app is available without adding application routes', async () => {
  const app = createServer(loadServerConfig({}))

  const response = await app.inject({
    method: 'GET',
    url: '/',
    headers: { host: '127.0.0.1:3000' },
  })

  expect(response.statusCode).toBe(404)
  await app.close()
})
