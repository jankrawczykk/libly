import { describe, expect, test } from 'vitest'
import {
  loadServerConfig,
  UnsafeHostError,
  UnsupportedServerArgumentError,
} from '../src/config.js'

describe('loadServerConfig', () => {
  test('defaults to loopback and the standard development port', () => {
    expect(loadServerConfig({})).toEqual({
      host: '127.0.0.1',
      port: 3000,
      riskAcknowledged: false,
    })
  })

  test('rejects a non-default address unless the risk flag is present', () => {
    expect(() => loadServerConfig({ HOST: '0.0.0.0' })).toThrow(UnsafeHostError)
  })

  test('accepts a non-default address only with the explicit risk flag', () => {
    expect(
      loadServerConfig({ HOST: '0.0.0.0', PORT: '8080' }, [
        '--i-understand-the-risks',
      ]),
    ).toEqual({
      host: '0.0.0.0',
      port: 8080,
      riskAcknowledged: true,
    })
  })

  test('accepts an IPv6 address only with the explicit risk flag', () => {
    expect(
      loadServerConfig({ HOST: '::1' }, ['--i-understand-the-risks']).host,
    ).toBe('::1')
  })

  test('rejects invalid ports and unsupported arguments', () => {
    expect(() => loadServerConfig({ PORT: '65536' })).toThrow()
    expect(() => loadServerConfig({}, ['--host=0.0.0.0'])).toThrow(
      UnsupportedServerArgumentError,
    )
  })
})
