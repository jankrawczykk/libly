import { QueryClient } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { createQueryClient } from '../src/app/query-client.js'
import { t } from '../src/i18n/index.js'

test('web providers use short-lived in-memory server state', () => {
  const client = createQueryClient()

  expect(client).toBeInstanceOf(QueryClient)
  expect(client.getDefaultOptions().queries?.staleTime).toBe(30_000)
  expect(client.getDefaultOptions().queries?.retry).toBe(false)
  expect(client.getQueryCache().getAll()).toEqual([])
})

test('Polish translations provide the login page scaffold strings', () => {
  expect(t('app.title')).toBe('Libly')
  expect(t('login.startDemo')).toBe('Uruchom tryb demo')
  expect(t('login.librusUnavailable')).toContain(
    'Nie wpisuj tu loginu ani hasła',
  )
})
