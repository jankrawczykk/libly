import { isIP } from 'node:net'
import { z } from 'zod'

const NON_LOOPBACK_ACKNOWLEDGEMENT = '--i-understand-the-risks'

const IPAddressSchema = z.string().refine((value) => isIP(value) > 0, {
  message: 'HOST must be an IP address',
})

const PortSchema = z
  .string()
  .regex(/^\d+$/, 'PORT must be a whole number')
  .transform(Number)
  .pipe(z.number().int().min(0).max(65535))

const ServerEnvironmentSchema = z.object({
  HOST: IPAddressSchema.default('127.0.0.1'),
  PORT: z.string().default('3000').pipe(PortSchema),
})

const ServerConfigSchema = z.object({
  host: IPAddressSchema,
  port: z.number().int().min(0).max(65535),
  riskAcknowledged: z.boolean(),
})

export interface ServerConfig {
  host: string
  port: number
  riskAcknowledged: boolean
}

export class UnsafeHostError extends Error {
  constructor(host: string) {
    super(`Refusing to bind to ${host} without ${NON_LOOPBACK_ACKNOWLEDGEMENT}.`)
    this.name = 'UnsafeHostError'
  }
}

export class UnsupportedServerArgumentError extends Error {
  constructor(argument: string) {
    super(`Unsupported server argument: ${argument}`)
    this.name = 'UnsupportedServerArgumentError'
  }
}

export function validateServerConfig(candidate: unknown): ServerConfig {
  const config = ServerConfigSchema.parse(candidate)

  if (
    config.host !== '127.0.0.1' &&
    !config.riskAcknowledged
  ) {
    throw new UnsafeHostError(config.host)
  }

  return config
}

export function loadServerConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  arguments_: readonly string[] = [],
): ServerConfig {
  const unsupportedArgument = arguments_.find(
    (argument) => argument !== NON_LOOPBACK_ACKNOWLEDGEMENT,
  )

  if (unsupportedArgument !== undefined) {
    throw new UnsupportedServerArgumentError(unsupportedArgument)
  }

  const environmentConfig = ServerEnvironmentSchema.parse({
    HOST: environment['HOST'],
    PORT: environment['PORT'],
  })

  return validateServerConfig({
    host: environmentConfig.HOST,
    port: environmentConfig.PORT,
    riskAcknowledged: arguments_.includes(NON_LOOPBACK_ACKNOWLEDGEMENT),
  })
}
