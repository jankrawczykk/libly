import { getSchoolProfilePreset } from '@libly/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { SCHOOL_PROFILE_QUERY_KEY } from '../src/features/dashboard/school-type-storage.js'
import { SettingsPage } from '../src/features/settings/settings-page.js'

function renderSettingsPage() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['session'], { authenticated: true })
  queryClient.setQueryData(
    SCHOOL_PROFILE_QUERY_KEY,
    getSchoolProfilePreset('technikum').profile,
  )

  const markup = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, createElement(SettingsPage)),
    ),
  )
  queryClient.clear()
  return markup
}

test('exposes school, attendance, grade, term, and subject profile settings', () => {
  const markup = renderSettingsPage()

  expect(markup).toContain('Ustawienia szkoły')
  expect(markup).toContain('Próg krytyczny (procent)')
  expect(markup).toContain('Zakres progu')
  expect(markup).toContain('Okres oceny progu')
  expect(markup).toContain('Mapowanie symboli frekwencji')
  expect(markup).toContain('Skala ocen')
  expect(markup).toContain('Sposób liczenia praktyk zawodowych')
  expect(markup).toContain('Struktura roku szkolnego')
  expect(markup).toContain('Reguły przedmiotów')
  expect(markup).toContain('Przywróć preset dla typu szkoły')
  expect(markup).toContain('Eksportuj profil JSON')
  expect(markup).toContain('Importuj profil JSON')
})
