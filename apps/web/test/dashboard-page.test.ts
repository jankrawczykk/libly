import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { DashboardPage } from '../src/features/dashboard/dashboard-page.js'

function renderDashboard() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['session'], { authenticated: true })
  queryClient.setQueryData(['school-type'], 'primary')
  queryClient.setQueryData(
    ['attendance'],
    [
      {
        date: '2026-09-01',
        lessonNumber: 1,
        subject: 'Matematyka',
        kind: 'present',
        rawSymbol: 'synthetic_present',
        semester: 1,
      },
      {
        date: '2026-09-02',
        lessonNumber: 2,
        subject: 'Historia',
        kind: 'present',
        rawSymbol: 'synthetic_present',
        semester: 1,
      },
      {
        date: '2026-09-03',
        lessonNumber: 3,
        subject: 'Historia',
        kind: 'absent_unexcused',
        rawSymbol: 'synthetic_absence',
        semester: 1,
      },
      {
        date: '2026-09-04',
        lessonNumber: 4,
        subject: 'Chemia',
        kind: 'absent_unexcused',
        rawSymbol: 'synthetic_absence',
        semester: 1,
      },
      {
        date: '2026-09-05',
        lessonNumber: 5,
        subject: 'Plastyka',
        kind: 'exempt',
        rawSymbol: 'synthetic_exempt',
        semester: 1,
      },
    ],
  )
  const markup = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, createElement(DashboardPage)),
    ),
  )
  queryClient.clear()
  return markup
}

test('shows annual overall attendance and semesters from validated data', () => {
  const markup = renderDashboard()

  expect(markup).toContain('Frekwencja ogółem — cały rok')
  expect(markup).toContain('50%')
  expect(markup).toContain('Obecność na 2 z 4 liczonych lekcji')
  expect(markup).toContain('Semestr 1')
  expect(markup).toContain('Semestr 2')
})

test('orders subjects from lowest attendance to highest', () => {
  const markup = renderDashboard()
  const chemistryPosition = markup.indexOf('Chemia')
  const historyPosition = markup.indexOf('Historia')
  const mathematicsPosition = markup.indexOf('Matematyka')

  expect(chemistryPosition).toBeLessThan(historyPosition)
  expect(historyPosition).toBeLessThan(mathematicsPosition)
})

test('shows the school preset as typical and asks users to verify it', () => {
  const markup = renderDashboard()

  expect(markup).toContain('Typowe wartości, sprawdź statut swojej szkoły')
  expect(markup).toContain('Sprawdź wartości w statucie swojej szkoły')
})

test('shows accessible text and icons for critical, warning, okay, and unknown statuses', () => {
  const markup = renderDashboard()

  expect(markup).toContain('Poniżej progu krytycznego')
  expect(markup).toContain('Poniżej progu ostrzegawczego')
  expect(markup).toContain('Osiągnięto próg ostrzegawczy')
  expect(markup).toContain('Brak danych do oceny')
  expect(markup).toContain(
    'aria-label="Status frekwencji: Poniżej progu krytycznego"',
  )
  expect(markup).toContain('aria-hidden="true">!</span>')
  expect(markup).toContain('aria-hidden="true">✓</span>')
})
