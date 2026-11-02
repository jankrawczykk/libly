import { expect, test } from 'vitest'
import { createServer } from '../src/index.js'

test('server app is available without adding application routes', async () => {
  const app = createServer()

  const response = await app.inject({ method: 'GET', url: '/' })

  expect(response.statusCode).toBe(404)
  await app.close()
})
