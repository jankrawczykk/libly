import { describe, expect, test } from 'vitest'
import { createServer } from '../src/app.js'
import { loadServerConfig } from '../src/config.js'

const config = loadServerConfig({})
const requestHeaders = {
  host: '127.0.0.1:3000',
  origin: 'http://127.0.0.1:3000',
}

describe('server logging', () => {
  test('redacts credentials, cookies, authorization, and error messages', async () => {
    let output = ''
    const app = createServer(config, undefined, undefined, {
      write: (message: string): void => {
        output = output.concat(message)
      },
    })
    const syntheticPassword = 'synthetic-password-sentinel'
    const syntheticCookie = 'synthetic-cookie-sentinel'
    const syntheticAuthorization = 'synthetic-authorization-sentinel'

    app.post('/test/log-error', () => {
      throw new Error(syntheticPassword)
    })

    const response = await app.inject({
      method: 'POST',
      url: '/test/log-error',
      headers: {
        ...requestHeaders,
        cookie: syntheticCookie,
        authorization: syntheticAuthorization,
      },
      payload: { password: syntheticPassword },
    })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Request failed.',
    })
    app.log.error(
      {
        password: syntheticPassword,
        credentials: { password: syntheticPassword },
        cookie: syntheticCookie,
        authorization: syntheticAuthorization,
        err: new Error(syntheticPassword),
      },
      'synthetic logging redaction check',
    )
    expect(output).not.toContain(syntheticPassword)
    expect(output).not.toContain(syntheticCookie)
    expect(output).not.toContain(syntheticAuthorization)
    expect(output).not.toContain('/test/log-error')
    expect(output).toContain('[REDACTED]')
    await app.close()
  })
})
