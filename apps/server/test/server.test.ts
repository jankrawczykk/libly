import { describe, expect, test, vi } from 'vitest'
import { loadServerConfig } from '../src/config.js'
import {
  registerGracefulShutdown,
  startServer,
  type ShutdownSignal,
} from '../src/server.js'

describe('startServer', () => {
  test('prints a loud warning when the explicit risk flag is passed', async () => {
    const config = loadServerConfig(
      { PORT: '0' },
      ['--i-understand-the-risks'],
    )
    const warning = vi.fn<(message: string) => void>()
    const app = await startServer(config, { once: () => undefined }, warning)

    expect(app.server.listening).toBe(true)
    expect(warning).toHaveBeenCalledOnce()
    expect(warning.mock.calls[0]?.[0]).toContain('!!! SECURITY WARNING !!!')

    await app.close()
  })
})

describe('registerGracefulShutdown', () => {
  test('closes the server only once when either shutdown signal is received', async () => {
    const handlers = new Map<ShutdownSignal, () => void>()
    const close = vi.fn(() => Promise.resolve())

    registerGracefulShutdown(
      { close },
      {
        once: (signal, listener) => {
          handlers.set(signal, listener)
        },
      },
    )

    handlers.get('SIGTERM')?.()
    handlers.get('SIGINT')?.()
    await Promise.resolve()

    expect(close).toHaveBeenCalledOnce()
  })

  test('reports shutdown failures', async () => {
    const handlers = new Map<ShutdownSignal, () => void>()
    const failure = new Error('close failed')
    const onError = vi.fn<(error: unknown) => void>()

    registerGracefulShutdown(
      { close: () => Promise.reject(failure) },
      {
        once: (signal, listener) => {
          handlers.set(signal, listener)
        },
      },
      onError,
    )

    handlers.get('SIGTERM')?.()
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(failure)
    })
  })
})
