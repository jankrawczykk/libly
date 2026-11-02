import { loadServerConfig } from './config.js'
import { startServer } from './server.js'

try {
  const config = loadServerConfig(process.env, process.argv.slice(2))
  await startServer(config)
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`Server failed to start: ${message}`)
  process.exitCode = 1
}
