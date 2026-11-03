import { QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { createQueryClient } from '../src/app/query-client.js'
import { LoginPage } from '../src/features/login/login-page.js'

function renderLogin(
  initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/'],
) {
  const queryClient = createQueryClient()
  queryClient.setQueryData(['session'], { authenticated: false })

  const markup = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries }, createElement(LoginPage)),
    ),
  )
  queryClient.clear()
  return markup
}

test('explains local demo privacy and does not request unavailable credentials', () => {
  const markup = renderLogin()

  expect(markup).toContain('Twoja prywatność')
  expect(markup).toContain('danych syntetycznych')
  expect(markup).toContain('Uruchom tryb demo')
  expect(markup).toContain('Logowanie do Librusa nie jest jeszcze dostępne')
  expect(markup).toContain('Nie wpisuj tu loginu ani hasła')
  expect(markup).not.toContain('<input')
})

test('explains why the user returned to login after session expiry', () => {
  const markup = renderLogin([
    { pathname: '/', state: { reason: 'session-expired' } },
  ])

  expect(markup).toContain('Sesja wygasła. Zaloguj się ponownie.')
})

test('confirms a deliberate logout', () => {
  const markup = renderLogin([
    { pathname: '/', state: { reason: 'logged-out' } },
  ])

  expect(markup).toContain('Wylogowano bezpiecznie.')
})
