import { QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { createQueryClient } from '../src/app/query-client.js'
import { LoginPage } from '../src/features/login/login-page.js'

test('explains local demo privacy and does not request unavailable credentials', () => {
  const queryClient = createQueryClient()
  queryClient.setQueryData(['session'], { authenticated: false })

  const markup = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, createElement(LoginPage)),
    ),
  )

  expect(markup).toContain('Twoja prywatność')
  expect(markup).toContain('danych syntetycznych')
  expect(markup).toContain('Uruchom tryb demo')
  expect(markup).toContain('Logowanie do Librusa nie jest jeszcze dostępne')
  expect(markup).toContain('Nie wpisuj tu loginu ani hasła')
  expect(markup).not.toContain('<input')
  queryClient.clear()
})
