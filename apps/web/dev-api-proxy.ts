import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ProxyOptions } from 'vite'

const DEV_API_ORIGIN = 'http://127.0.0.1:3000'
const ALLOWED_DEV_HOSTS = new Set(['127.0.0.1:5173', 'localhost:5173'])
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function isAllowedApiProxyRequest(
  request: Pick<IncomingMessage, 'headers' | 'method'>,
): boolean {
  const host = request.headers.host
  if (host === undefined || !ALLOWED_DEV_HOSTS.has(host.toLowerCase())) {
    return false
  }

  if (!STATE_CHANGING_METHODS.has(request.method ?? '')) {
    return true
  }

  return request.headers.origin === `http://${host}`
}

export function rejectApiProxyRequest(
  response: ServerResponse | undefined,
): false {
  if (response !== undefined) {
    response.writeHead(403, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    })
    response.end(
      JSON.stringify({
        code: 'REQUEST_REJECTED',
        message: 'Request rejected.',
      }),
    )
  }

  return false
}

export const DEV_API_PROXY_OPTIONS: ProxyOptions = {
  target: DEV_API_ORIGIN,
  changeOrigin: true,
  configure(proxy) {
    proxy.on('proxyReq', (proxyRequest, request) => {
      if (STATE_CHANGING_METHODS.has(request.method ?? '')) {
        proxyRequest.setHeader('origin', DEV_API_ORIGIN)
      }
    })
  },
  bypass(request: IncomingMessage, response: ServerResponse | undefined) {
    if (!isAllowedApiProxyRequest(request)) {
      return rejectApiProxyRequest(response)
    }

    return undefined
  },
}
