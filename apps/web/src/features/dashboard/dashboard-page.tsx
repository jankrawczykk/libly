import {
  ATTENDANCE_KINDS,
  AttendanceKindSchema,
  calculateAttendanceSummary,
  classifyAttendanceStatus,
  getSchoolProfilePreset,
  SUBJECT_CATEGORIES,
  SubjectCategorySchema,
  SchoolTypeSchema,
  SCHOOL_TYPES,
  suggestSubjectCategory,
  type AttendancePeriodSummary,
  type AttendanceStatus,
  type AttendanceKind,
  type SchoolProfile,
  type SubjectCategory,
  type SchoolType,
} from '@libly/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SyntheticEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiClientError, apiClient } from '../../api/client.js'
import { t, type TranslationKey } from '../../i18n/index.js'
import {
  clearSchoolProfilePreference,
  InvalidSchoolProfilePreferenceError,
  readSchoolProfilePreference,
  saveSchoolProfilePreference,
  SCHOOL_PROFILE_QUERY_KEY,
} from './school-type-storage.js'
import styles from './dashboard-page.module.css'

const SESSION_QUERY_KEY = ['session'] as const
const ATTENDANCE_QUERY_KEY = ['attendance'] as const
type AttendancePeriod = keyof AttendancePeriodSummary
const ATTENDANCE_PERIODS: readonly AttendancePeriod[] = [
  'year',
  'semester1',
  'semester2',
]

const SCHOOL_TYPE_TRANSLATION_KEYS: Record<SchoolType, TranslationKey> = {
  primary: 'school.primary',
  general_lyceum: 'school.generalLyceum',
  technikum: 'school.technikum',
  vocational_stage1: 'school.vocationalStage1',
  vocational_stage2: 'school.vocationalStage2',
  post_secondary: 'school.postSecondary',
  other: 'school.other',
}

const ATTENDANCE_KIND_TRANSLATION_KEYS: Record<AttendanceKind, TranslationKey> =
  {
    present: 'settings.kindPresent',
    late: 'settings.kindLate',
    absent_unexcused: 'settings.kindAbsentUnexcused',
    absent_excused: 'settings.kindAbsentExcused',
    exempt: 'settings.kindExempt',
    school_trip: 'settings.kindSchoolTrip',
    other: 'settings.kindOther',
  }

const SUBJECT_CATEGORY_TRANSLATION_KEYS: Record<
  SubjectCategory,
  TranslationKey
> = {
  general: 'settings.categoryGeneral',
  vocational: 'settings.categoryVocational',
  practical_classes: 'settings.categoryPractical',
  work_placement: 'settings.categoryPlacement',
  physical_education: 'settings.categoryPhysicalEducation',
  religion_ethics: 'settings.categoryReligionEthics',
  behavior: 'settings.categoryBehavior',
  custom: 'settings.categoryCustom',
}

const ATTENDANCE_STATUS_TRANSLATION_KEYS: Record<
  AttendanceStatus,
  TranslationKey
> = {
  critical: 'dashboard.statusCritical',
  warning: 'dashboard.statusWarning',
  ok: 'dashboard.statusOk',
  unknown: 'dashboard.statusUnknown',
}

const ATTENDANCE_STATUS_ICONS: Record<AttendanceStatus, string> = {
  critical: '!',
  warning: '!',
  ok: '✓',
  unknown: '—',
}

const ATTENDANCE_PERIOD_TRANSLATION_KEYS: Record<
  AttendancePeriod,
  TranslationKey
> = {
  year: 'dashboard.periodYear',
  semester1: 'dashboard.periodSemesterOne',
  semester2: 'dashboard.periodSemesterTwo',
}

function formatPercentage(percentage: number | null): string {
  if (percentage === null) {
    return t('dashboard.noAttendanceData')
  }

  return `${new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 1,
  }).format(percentage)}%`
}

function getStatusPercentage(
  summary: AttendancePeriodSummary,
  period: AttendancePeriod,
  thresholdPeriod: 'semester' | 'year',
): number | null {
  if (thresholdPeriod === 'year') {
    return summary.year.percentage
  }
  if (period !== 'year') {
    return summary[period].percentage
  }

  const semesterPercentages = [
    summary.semester1.percentage,
    summary.semester2.percentage,
  ].filter((percentage): percentage is number => percentage !== null)
  return semesterPercentages.length === 0
    ? null
    : Math.min(...semesterPercentages)
}

function AttendanceStatusBadge({
  percentage,
  thresholds,
}: {
  percentage: number | null
  thresholds: {
    criticalThreshold: number
    warningThreshold: number
  }
}) {
  const status = classifyAttendanceStatus(percentage, thresholds)
  const label = t(ATTENDANCE_STATUS_TRANSLATION_KEYS[status])

  return (
    <span
      className={styles['statusBadge']}
      data-status={status}
      aria-label={t('dashboard.statusAccessible', { status: label })}
    >
      <span className={styles['statusIcon']} aria-hidden="true">
        {ATTENDANCE_STATUS_ICONS[status]}
      </span>
      {label}
    </span>
  )
}

function ProfileSetup({
  onSaved,
}: {
  onSaved: (profile: SchoolProfile) => void
}) {
  const attendanceQuery = useQuery({
    queryKey: ATTENDANCE_QUERY_KEY,
    queryFn: apiClient.getAttendance,
  })
  const [selectedSchoolType, setSelectedSchoolType] = useState<SchoolType | ''>(
    '',
  )
  const [step, setStep] = useState(1)
  const [subjectCategories, setSubjectCategories] = useState<
    Record<string, SubjectCategory | ''>
  >({})
  const [symbolMappings, setSymbolMappings] = useState<
    Record<string, AttendanceKind | ''>
  >({})
  const [saveError, setSaveError] = useState(false)
  const profilePreset =
    selectedSchoolType === ''
      ? undefined
      : getSchoolProfilePreset(selectedSchoolType)
  const subjects =
    attendanceQuery.data === undefined
      ? []
      : [...new Set(attendanceQuery.data.map((entry) => entry.subject))].sort(
          (first, second) => first.localeCompare(second, 'pl'),
        )
  const symbols =
    attendanceQuery.data === undefined
      ? []
      : [...new Set(attendanceQuery.data.map((entry) => entry.rawSymbol))].sort(
          (first, second) => first.localeCompare(second, 'pl'),
        )

  function getCategory(subject: string): SubjectCategory | '' {
    const suggestedCategory = suggestSubjectCategory(subject)
    return subjectCategories[subject] ?? suggestedCategory ?? ''
  }

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault()
    const result = SchoolTypeSchema.safeParse(selectedSchoolType)
    if (!result.success) {
      return
    }

    const confirmedSubjectRules: SchoolProfile['subjectRules'] = []
    for (const subject of subjects) {
      const categoryResult = SubjectCategorySchema.safeParse(
        getCategory(subject),
      )
      if (!categoryResult.success) {
        setSaveError(true)
        return
      }
      confirmedSubjectRules.push({
        subject,
        category: categoryResult.data,
        includeInOverallAverage: true,
        includeInOverallAttendance: true,
      })
    }

    const confirmedSymbols: [string, AttendanceKind][] = []
    for (const symbol of symbols) {
      const kindResult = AttendanceKindSchema.safeParse(symbolMappings[symbol])
      if (!kindResult.success) {
        setSaveError(true)
        return
      }
      confirmedSymbols.push([symbol, kindResult.data])
    }

    if (confirmedSubjectRules.length !== subjects.length) {
      setSaveError(true)
      return
    }

    try {
      const preset = getSchoolProfilePreset(result.data).profile
      const profile = {
        ...preset,
        attendance: {
          ...preset.attendance,
          symbolMap: Object.fromEntries(confirmedSymbols),
        },
        subjectRules: confirmedSubjectRules,
      }
      saveSchoolProfilePreference(window.localStorage, profile)
      onSaved(profile)
    } catch (error) {
      if (error instanceof DOMException) {
        setSaveError(true)
        return
      }
      throw error
    }
  }

  if (attendanceQuery.isPending) {
    return <p role="status">{t('dashboard.profileDataLoading')}</p>
  }

  if (attendanceQuery.isError) {
    return (
      <section className={styles['card']} aria-labelledby="profile-title">
        <h2 id="profile-title" className={styles['sectionTitle']}>
          {t('dashboard.profileSetupTitle')}
        </h2>
        <p className={styles['error']} role="alert">
          {t('dashboard.profileDataLoadError')}
        </p>
        <button
          className={styles['secondaryButton']}
          onClick={() => {
            void attendanceQuery.refetch()
          }}
          type="button"
        >
          {t('login.retry')}
        </button>
      </section>
    )
  }

  const hasUnconfirmedCategories = subjects.some(
    (subject) => getCategory(subject) === '',
  )
  const hasUnmappedSymbols = symbols.some(
    (symbol) =>
      symbolMappings[symbol] === undefined || symbolMappings[symbol] === '',
  )

  return (
    <section className={styles['card']} aria-labelledby="profile-title">
      <h1 id="profile-title" className={styles['sectionTitle']}>
        {t('dashboard.profileSetupTitle')}
      </h1>
      <p>{t('dashboard.profileSetupExplanation')}</p>
      <p className={styles['stepIndicator']} aria-live="polite">
        {t('dashboard.profileSetupStep', { step })}
      </p>
      <form onSubmit={submit}>
        {step === 1 ? (
          <>
            <label className={styles['fieldLabel']} htmlFor="school-type">
              {t('dashboard.schoolTypeLabel')}
            </label>
            <select
              className={styles['select']}
              id="school-type"
              onChange={(event) => {
                const result = SchoolTypeSchema.safeParse(
                  event.currentTarget.value,
                )
                setSelectedSchoolType(result.success ? result.data : '')
                setSaveError(false)
              }}
              required
              value={selectedSchoolType}
            >
              <option value="" disabled>
                {t('dashboard.schoolTypePlaceholder')}
              </option>
              {SCHOOL_TYPES.map((schoolType) => (
                <option key={schoolType} value={schoolType}>
                  {t(SCHOOL_TYPE_TRANSLATION_KEYS[schoolType])}
                </option>
              ))}
            </select>

            {profilePreset === undefined ? null : (
              <div className={styles['presetReview']} aria-live="polite">
                <p className={styles['presetLabel']}>{profilePreset.label}</p>
                <p>
                  {t('dashboard.presetThresholds', {
                    critical:
                      profilePreset.profile.attendance.criticalThreshold,
                    warning: profilePreset.profile.attendance.warningThreshold,
                  })}
                </p>
                <p>{t('dashboard.presetScope')}</p>
                <p className={styles['verifyNotice']}>
                  {t('dashboard.verifyPreset')}
                </p>
              </div>
            )}
          </>
        ) : null}

        {step === 2 ? (
          <fieldset className={styles['wizardFieldset']}>
            <legend className={styles['sectionTitle']}>
              {t('dashboard.subjectCategoryTitle')}
            </legend>
            <p>{t('dashboard.subjectCategoryExplanation')}</p>
            {subjects.length === 0 ? (
              <p>{t('dashboard.noSubjectsToConfirm')}</p>
            ) : (
              subjects.map((subject) => (
                <div className={styles['wizardRow']} key={subject}>
                  <label
                    className={styles['fieldLabel']}
                    htmlFor={`category-${subject}`}
                  >
                    {subject}
                  </label>
                  <select
                    className={styles['select']}
                    id={`category-${subject}`}
                    onChange={(event) => {
                      const result = SubjectCategorySchema.safeParse(
                        event.currentTarget.value,
                      )
                      if (result.success) {
                        setSubjectCategories((current) => ({
                          ...current,
                          [subject]: result.data,
                        }))
                      }
                    }}
                    value={getCategory(subject)}
                  >
                    <option value="">
                      {t('dashboard.categoryPlaceholder')}
                    </option>
                    {SUBJECT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {t(SUBJECT_CATEGORY_TRANSLATION_KEYS[category])}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset className={styles['wizardFieldset']}>
            <legend className={styles['sectionTitle']}>
              {t('dashboard.attendanceSymbolTitle')}
            </legend>
            <p>{t('dashboard.attendanceSymbolExplanation')}</p>
            {symbols.length === 0 ? (
              <p>{t('dashboard.noSymbolsToMap')}</p>
            ) : (
              symbols.map((symbol) => (
                <div className={styles['wizardRow']} key={symbol}>
                  <label
                    className={styles['fieldLabel']}
                    htmlFor={`symbol-${symbol}`}
                  >
                    {symbol}
                  </label>
                  <select
                    className={styles['select']}
                    id={`symbol-${symbol}`}
                    onChange={(event) => {
                      const result = AttendanceKindSchema.safeParse(
                        event.currentTarget.value,
                      )
                      if (result.success) {
                        setSymbolMappings((current) => ({
                          ...current,
                          [symbol]: result.data,
                        }))
                      }
                    }}
                    value={symbolMappings[symbol] ?? ''}
                  >
                    <option value="">{t('dashboard.symbolPlaceholder')}</option>
                    {ATTENDANCE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(ATTENDANCE_KIND_TRANSLATION_KEYS[kind])}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </fieldset>
        ) : null}

        {saveError ? (
          <p className={styles['error']} role="alert">
            {t('dashboard.profileSaveError')}
          </p>
        ) : null}
        <div className={styles['wizardActions']}>
          {step > 1 ? (
            <button
              className={styles['secondaryButton']}
              onClick={() => {
                setStep((current) => current - 1)
                setSaveError(false)
              }}
              type="button"
            >
              {t('dashboard.profileSetupBack')}
            </button>
          ) : null}
          {step < 3 ? (
            <button
              className={styles['primaryButton']}
              disabled={
                step === 1
                  ? selectedSchoolType === ''
                  : hasUnconfirmedCategories
              }
              onClick={() => {
                setStep((current) => current + 1)
                setSaveError(false)
              }}
              type="button"
            >
              {t('dashboard.profileSetupNext')}
            </button>
          ) : (
            <button
              className={styles['primaryButton']}
              disabled={hasUnmappedSymbols}
              type="submit"
            >
              {t('dashboard.confirmProfile')}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

function DashboardContent({
  schoolProfile,
  onChangeProfile,
}: {
  schoolProfile: SchoolProfile
  onChangeProfile: () => void
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<AttendancePeriod>('year')
  const attendanceQuery = useQuery({
    queryKey: ATTENDANCE_QUERY_KEY,
    queryFn: apiClient.getAttendance,
  })
  if (attendanceQuery.isPending) {
    return <p role="status">{t('dashboard.loading')}</p>
  }

  if (attendanceQuery.isError) {
    const message =
      attendanceQuery.error instanceof ApiClientError &&
      attendanceQuery.error.code === 'UNAUTHENTICATED'
        ? t('dashboard.sessionExpired')
        : t('dashboard.loadError')
    return (
      <section className={styles['card']} aria-labelledby="dashboard-title">
        <h1 id="dashboard-title">{t('dashboard.title')}</h1>
        <p className={styles['error']} role="alert">
          {message}
        </p>
        <Link className={styles['textLink']} to="/">
          {t('dashboard.returnToLogin')}
        </Link>
      </section>
    )
  }

  const summary = calculateAttendanceSummary(
    attendanceQuery.data,
    schoolProfile,
  )
  const periodLabel = t(ATTENDANCE_PERIOD_TRANSLATION_KEYS[selectedPeriod])
  const overall = summary.overall[selectedPeriod]
  const orderedSubjects = [...summary.subjects].sort((first, second) => {
    const firstPercentage = first[selectedPeriod].percentage
    const secondPercentage = second[selectedPeriod].percentage
    if (firstPercentage === null) {
      return secondPercentage === null
        ? first.subject.localeCompare(second.subject, 'pl')
        : 1
    }
    if (secondPercentage === null) {
      return -1
    }
    return (
      firstPercentage - secondPercentage ||
      first.subject.localeCompare(second.subject, 'pl')
    )
  })

  return (
    <>
      <header className={styles['header']}>
        <div>
          <p className={styles['eyebrow']}>{t('app.title')}</p>
          <h1 id="dashboard-title">{t('dashboard.title')}</h1>
        </div>
        <div className={styles['headerActions']}>
          <Link className={styles['textLink']} to="/settings">
            {t('dashboard.settings')}
          </Link>
          <button
            className={styles['secondaryButton']}
            onClick={onChangeProfile}
          >
            {t('dashboard.changeSchoolType')}
          </button>
        </div>
      </header>

      <p className={styles['presetNotice']}>
        {t('dashboard.activeProfile', {
          schoolType: t(SCHOOL_TYPE_TRANSLATION_KEYS[schoolProfile.schoolType]),
        })}
      </p>
      <p className={styles['presetNotice']}>
        {t('dashboard.statusPeriodNote', {
          period: t(
            schoolProfile.attendance.period === 'year'
              ? 'dashboard.thresholdPeriodYear'
              : 'dashboard.thresholdPeriodSemester',
          ),
        })}
      </p>

      <div
        className={styles['periodSwitcher']}
        role="group"
        aria-label={t('dashboard.periodSelector')}
      >
        {ATTENDANCE_PERIODS.map((period) => (
          <button
            aria-pressed={selectedPeriod === period}
            className={styles['periodButton']}
            key={period}
            onClick={() => {
              setSelectedPeriod(period)
            }}
            type="button"
          >
            {t(ATTENDANCE_PERIOD_TRANSLATION_KEYS[period])}
          </button>
        ))}
      </div>

      <section
        className={styles['overallCard']}
        aria-labelledby="overall-title"
      >
        <h2 id="overall-title">
          {t('dashboard.overallAttendanceForPeriod', { period: periodLabel })}
        </h2>
        <p className={styles['overallValue']}>
          {formatPercentage(overall.percentage)}
        </p>
        {schoolProfile.attendance.scope === 'overall' ||
        schoolProfile.attendance.scope === 'both' ? (
          <AttendanceStatusBadge
            percentage={getStatusPercentage(
              summary.overall,
              selectedPeriod,
              schoolProfile.attendance.period,
            )}
            thresholds={schoolProfile.attendance}
          />
        ) : null}
        <p>
          {t('dashboard.lessonCount', {
            present: overall.presentLessons,
            counted: overall.countedLessons,
          })}
        </p>
      </section>

      <section
        className={styles['subjectSection']}
        aria-labelledby="subjects-title"
      >
        <h2 id="subjects-title">{t('dashboard.subjectsTitle')}</h2>
        {orderedSubjects.length === 0 ? (
          <p>{t('dashboard.noSubjects')}</p>
        ) : (
          <ol className={styles['subjectList']}>
            {orderedSubjects.map((subject) => (
              <li className={styles['subjectItem']} key={subject.subject}>
                <div>
                  <h3>{subject.subject}</h3>
                  <p>
                    {t('dashboard.lessonCount', {
                      present: subject[selectedPeriod].presentLessons,
                      counted: subject[selectedPeriod].countedLessons,
                    })}
                  </p>
                </div>
                <div className={styles['subjectResult']}>
                  <strong>
                    {formatPercentage(subject[selectedPeriod].percentage)}
                  </strong>
                  {schoolProfile.attendance.scope === 'per_subject' ||
                  schoolProfile.attendance.scope === 'both' ? (
                    <AttendanceStatusBadge
                      percentage={getStatusPercentage(
                        subject,
                        selectedPeriod,
                        schoolProfile.attendance.period,
                      )}
                      thresholds={{
                        ...schoolProfile.attendance,
                        criticalThreshold:
                          schoolProfile.subjectRules.find(
                            (rule) => rule.subject === subject.subject,
                          )?.attendanceCriticalThreshold ??
                          schoolProfile.attendance.criticalThreshold,
                        warningThreshold:
                          schoolProfile.subjectRules.find(
                            (rule) => rule.subject === subject.subject,
                          )?.attendanceWarningThreshold ??
                          schoolProfile.attendance.warningThreshold,
                      }}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}

export function DashboardPage() {
  const queryClient = useQueryClient()
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [resetError, setResetError] = useState(false)
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: apiClient.getSession,
  })
  const schoolProfileQuery = useQuery({
    queryKey: SCHOOL_PROFILE_QUERY_KEY,
    queryFn: () => readSchoolProfilePreference(window.localStorage),
    enabled: sessionQuery.data?.authenticated === true,
    staleTime: Infinity,
  })

  if (sessionQuery.isPending) {
    return (
      <main className={styles['page']}>
        <p role="status">{t('dashboard.loading')}</p>
      </main>
    )
  }

  if (sessionQuery.isError || !sessionQuery.data.authenticated) {
    return <Navigate to="/" replace />
  }

  if (schoolProfileQuery.isPending) {
    return (
      <main className={styles['page']}>
        <p role="status">{t('dashboard.loading')}</p>
      </main>
    )
  }

  if (schoolProfileQuery.error instanceof InvalidSchoolProfilePreferenceError) {
    return (
      <main className={styles['page']}>
        <section
          className={styles['card']}
          aria-labelledby="profile-error-title"
        >
          <h1 id="profile-error-title">{t('dashboard.title')}</h1>
          <p className={styles['error']} role="alert">
            {t('dashboard.invalidStoredProfile')}
          </p>
          {resetError ? (
            <p className={styles['error']} role="alert">
              {t('dashboard.profileResetError')}
            </p>
          ) : null}
          <button
            className={styles['secondaryButton']}
            onClick={() => {
              try {
                clearSchoolProfilePreference(window.localStorage)
                queryClient.setQueryData(SCHOOL_PROFILE_QUERY_KEY, null)
                setResetError(false)
              } catch {
                setResetError(true)
              }
            }}
            type="button"
          >
            {t('dashboard.resetProfile')}
          </button>
        </section>
      </main>
    )
  }

  if (schoolProfileQuery.isError) {
    return (
      <main className={styles['page']}>
        <p className={styles['error']} role="alert">
          {t('dashboard.profileLoadError')}
        </p>
      </main>
    )
  }

  const schoolProfile = schoolProfileQuery.data
  if (schoolProfile === null || isEditingProfile) {
    return (
      <main className={styles['page']}>
        <header className={styles['header']}>
          <div>
            <p className={styles['eyebrow']}>{t('app.title')}</p>
            <h1>{t('dashboard.title')}</h1>
          </div>
          <Link className={styles['textLink']} to="/">
            {t('dashboard.returnToLogin')}
          </Link>
        </header>
        <ProfileSetup
          onSaved={(profile) => {
            queryClient.setQueryData(SCHOOL_PROFILE_QUERY_KEY, profile)
            queryClient.removeQueries({ queryKey: ATTENDANCE_QUERY_KEY })
            setIsEditingProfile(false)
          }}
        />
      </main>
    )
  }

  return (
    <main className={styles['page']}>
      <DashboardContent
        schoolProfile={schoolProfile}
        onChangeProfile={() => {
          setIsEditingProfile(true)
        }}
      />
    </main>
  )
}
