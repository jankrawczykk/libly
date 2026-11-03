import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  getSchoolProfilePreset,
  type AttendanceEntry,
  type SchoolProfile,
} from '@libly/core'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { DashboardPage } from '../src/features/dashboard/dashboard-page.js'

const ATTENDANCE_ENTRIES: AttendanceEntry[] = [
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
]

function renderDashboard(
  profile = getSchoolProfilePreset('primary').profile,
  additionalEntries: AttendanceEntry[] = [],
) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['session'], { authenticated: true })
  queryClient.setQueryData(['school-profile'], profile)
  queryClient.setQueryData(
    ['attendance'],
    [...ATTENDANCE_ENTRIES, ...additionalEntries],
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

function renderFirstRunSetup() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['session'], { authenticated: true })
  queryClient.setQueryData(['attendance'], ATTENDANCE_ENTRIES)
  queryClient.setQueryData(['school-profile'], null)
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

test('starts the first-run profile wizard before showing attendance', () => {
  const markup = renderFirstRunSetup()

  expect(markup).toContain('Ustaw profil szkoły')
  expect(markup).toContain('Krok 1 z 3')
  expect(markup).toContain('Typ szkoły')
  expect(markup).not.toContain('Frekwencja ogółem')
})

test('shows annual overall attendance and semesters from validated data', () => {
  const markup = renderDashboard()

  expect(markup).toContain('Frekwencja ogółem — Cały rok')
  expect(markup).toContain('50%')
  expect(markup).toContain('Obecność na 2 z 4 liczonych lekcji')
  expect(markup).toContain('Semestr 1')
  expect(markup).toContain('Semestr 2')
  expect(markup).toContain('role="group" aria-label="Wybierz okres frekwencji"')
  expect(markup).toContain('Wyloguj')
  expect(markup).toMatch(/aria-pressed="true"[^>]*>Cały rok<\/button>/u)
  expect(markup).toMatch(/aria-pressed="false"[^>]*>Semestr 1<\/button>/u)
  expect(markup).toMatch(/aria-pressed="false"[^>]*>Semestr 2<\/button>/u)
})

test('orders subjects from lowest attendance to highest', () => {
  const markup = renderDashboard()
  const chemistryPosition = markup.indexOf('Chemia')
  const historyPosition = markup.indexOf('Historia')
  const mathematicsPosition = markup.indexOf('Matematyka')

  expect(chemistryPosition).toBeLessThan(historyPosition)
  expect(historyPosition).toBeLessThan(mathematicsPosition)
})

test('shows the active school profile and asks users to verify its rules', () => {
  const markup = renderDashboard()

  expect(markup).toContain('Typ szkoły: Szkoła podstawowa')
  expect(markup).toContain(
    'Sprawdź ustawienia profilu w statucie swojej szkoły',
  )
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

test('uses saved thresholds to recalculate attendance statuses', () => {
  const profile: SchoolProfile = {
    ...getSchoolProfilePreset('primary').profile,
    attendance: {
      ...getSchoolProfilePreset('primary').profile.attendance,
      criticalThreshold: 80,
      warningThreshold: 90,
    },
  }
  const markup = renderDashboard(profile)

  expect(markup).toContain('data-status="critical"')
  expect(markup).toContain('Poniżej progu krytycznego')
})

test('shows absence buffer and recovery guidance for each subject', () => {
  const markup = renderDashboard()

  expect(markup).toContain('Możesz jeszcze opuścić 0 lekcji.')
  expect(markup).toContain(
    'Musisz być obecny na kolejnych 1 lekcjach, aby wrócić do progu.',
  )
})

test('shows unavailable guidance when a subject has no counted lessons', () => {
  const markup = renderDashboard()

  expect(markup).toContain('Nie można obliczyć zapasu — brak liczonych lekcji.')
  expect(markup).toContain(
    'Nie można obliczyć powrotu do progu — brak liczonych lekcji.',
  )
})

test('explains unlimited buffer and impossible recovery boundaries', () => {
  const unlimitedProfile = getSchoolProfilePreset('primary').profile
  const unlimitedMarkup = renderDashboard({
    ...unlimitedProfile,
    attendance: {
      ...unlimitedProfile.attendance,
      criticalThreshold: 0,
    },
  })
  const impossibleProfile = getSchoolProfilePreset('primary').profile
  const impossibleMarkup = renderDashboard({
    ...impossibleProfile,
    attendance: {
      ...impossibleProfile.attendance,
      criticalThreshold: 100,
    },
  })

  expect(unlimitedMarkup).toContain(
    'Próg nie ogranicza liczby kolejnych nieobecności.',
  )
  expect(impossibleMarkup).toContain(
    'Nie można wrócić do tego progu samą obecnością.',
  )
})

test('shows status badges only in the configured attendance scope', () => {
  const preset = getSchoolProfilePreset('primary').profile
  const profile: SchoolProfile = {
    ...preset,
    attendance: { ...preset.attendance, scope: 'overall' },
  }
  const markup = renderDashboard(profile)

  expect(markup.match(/Status frekwencji:/gu)).toHaveLength(1)
})

test('uses the configured evaluation period when classifying thresholds', () => {
  const preset = getSchoolProfilePreset('primary').profile
  const additionalEntries: AttendanceEntry[] = [
    {
      date: '2027-01-01',
      lessonNumber: 1,
      subject: 'Matematyka',
      kind: 'present',
      rawSymbol: 'synthetic_present',
      semester: 2,
    },
    {
      date: '2027-01-02',
      lessonNumber: 2,
      subject: 'Matematyka',
      kind: 'absent_unexcused',
      rawSymbol: 'synthetic_absence',
      semester: 2,
    },
    {
      date: '2027-01-03',
      lessonNumber: 3,
      subject: 'Matematyka',
      kind: 'absent_unexcused',
      rawSymbol: 'synthetic_absence',
      semester: 2,
    },
    {
      date: '2027-01-04',
      lessonNumber: 4,
      subject: 'Matematyka',
      kind: 'absent_unexcused',
      rawSymbol: 'synthetic_absence',
      semester: 2,
    },
  ]
  const rules: SchoolProfile['attendance'] = {
    ...preset.attendance,
    criticalThreshold: 30,
    warningThreshold: 40,
    scope: 'both',
  }
  const yearMarkup = renderDashboard(
    {
      ...preset,
      attendance: { ...rules, period: 'year' },
    },
    additionalEntries,
  )
  const semesterMarkup = renderDashboard(
    {
      ...preset,
      attendance: { ...rules, period: 'semester' },
    },
    additionalEntries,
  )

  expect(yearMarkup).toContain(
    'aria-label="Status frekwencji: Poniżej progu ostrzegawczego"',
  )
  expect(semesterMarkup).toContain(
    'aria-label="Status frekwencji: Poniżej progu krytycznego"',
  )
})
