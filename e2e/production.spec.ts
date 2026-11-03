import { expect, test } from '@playwright/test'

test('serves a CSP-protected build without inline or external requests', async ({
  page,
}) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      externalRequests.push(request.url())
    }
  })

  const response = await page.goto('/')
  expect(response).not.toBeNull()
  expect(response?.status()).toBe(200)
  expect(response?.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  )

  const inlineScripts = await page.locator('script:not([src])').count()
  expect(inlineScripts).toBe(0)
  expect(externalRequests).toEqual([])
})
