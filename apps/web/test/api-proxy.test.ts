import { expect, test } from 'vitest'
import { isAllowedApiProxyRequest } from '../dev-api-proxy.js'

test('allows same-origin loopback requests to the development proxy', () => {
  expect(
    isAllowedApiProxyRequest({
      headers: {
        host: '127.0.0.1:5173',
        origin: 'http://127.0.0.1:5173',
      },
      method: 'POST',
    }),
  ).toBe(true)
  expect(
    isAllowedApiProxyRequest({
      headers: {
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      },
      method: 'DELETE',
    }),
  ).toBe(true)
})

test.each([
  {
    headers: { host: '127.0.0.1:5173', origin: 'https://example.invalid' },
    method: 'POST',
  },
  {
    headers: { host: 'evil.example', origin: 'http://evil.example' },
    method: 'POST',
  },
  {
    headers: { host: '127.0.0.1:5174', origin: 'http://127.0.0.1:5174' },
    method: 'DELETE',
  },
])(
  'rejects cross-origin or unexpected development proxy requests',
  (request) => {
    expect(isAllowedApiProxyRequest(request)).toBe(false)
  },
)

test('allows non-mutating requests only through the configured loopback host', () => {
  expect(
    isAllowedApiProxyRequest({
      headers: { host: '127.0.0.1:5173' },
      method: 'GET',
    }),
  ).toBe(true)
  expect(
    isAllowedApiProxyRequest({
      headers: { host: '127.0.0.1:5173' },
      method: 'POST',
    }),
  ).toBe(false)
})
