import type { FastifyInstance } from 'fastify'
import { validateServerConfig, type ServerConfig } from './config.js'
import { createServer } from './app.js'

export type ShutdownSignal = 'SIGINT' | 'SIGTERM'

export interface ShutdownSignalSource {
  once(signal: ShutdownSignal, listener: () => void): void
}

export interface GracefulShutdownApp {
  close(): Promise<unknown>
}

const processSignalSource: ShutdownSignalSource = {
  once: (signal, listener) => {
    process.once(signal, listener)
  },
}

const RISK_WARNING = [
  '',
  '!!! SECURITY WARNING !!!',
  'The --i-understand-the-risks flag is active.',
  'Binding to a non-loopback address can make Libly reachable by other devices.',
  'Continue only if you understand the risks.',
  '',
].join('\n')

export function registerGracefulShutdown(
  app: GracefulShutdownApp,
  signals: ShutdownSignalSource = processSignalSource,
  onError: (error: unknown) => void = (error) => {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Graceful server shutdown failed: ${message}`)
    process.exitCode = 1
  },
): void {
  let closing: Promise<unknown> | undefined
  const shutdown = (): void => {
    if (closing !== undefined) {
      return
    }

    const closePromise = Promise.resolve().then(() => app.close())
    closing = closePromise
    void closePromise.catch(onError)
  }

  signals.once('SIGINT', shutdown)
  signals.once('SIGTERM', shutdown)
}

export async function startServer(
  candidate: ServerConfig,
  signals: ShutdownSignalSource = processSignalSource,
  warn: (message: string) => void = (message) => {
    console.error(message)
  },
): Promise<FastifyInstance> {
  const config = validateServerConfig(candidate)

  if (config.riskAcknowledged) {
    warn(RISK_WARNING)
  }

  const app = createServer(config, undefined, undefined, undefined, undefined, {
    serveWeb: true,
  })
  await app.listen({ host: config.host, port: config.port })
  registerGracefulShutdown(app, signals)
  return app
}
