import {
  calculateAttendanceSummary,
  getSchoolProfilePreset,
  SchoolTypeSchema,
  SCHOOL_TYPES,
  type SchoolType,
} from '@libly/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SyntheticEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiClientError, apiClient } from '../../api/client.js'
import { t, type TranslationKey } from '../../i18n/index.js'
import {
  clearSchoolTypePreference,
  InvalidSchoolTypePreferenceError,
  readSchoolTypePreference,
  saveSchoolTypePreference,
  SCHOOL_TYPE_QUERY_KEY,
} from './school-type-storage.js'
import styles from './dashboard-page.module.css'

const SESSION_QUERY_KEY = ['session'] as const
const ATTENDANCE_QUERY_KEY = ['attendance'] as const

const SCHOOL_TYPE_TRANSLATION_KEYS: Record<SchoolType, TranslationKey> = {
  primary: 'school.primary',
  general_lyceum: 'school.generalLyceum',
  technikum: 'school.technikum',
  vocational_stage1: 'school.vocationalStage1',
  vocational_stage2: 'school.vocationalStage2',
  post_secondary: 'school.postSecondary',
  other: 'school.other',
}

function formatPercentage(percentage: number | null): string {
  if (percentage === null) {
    return t('dashboard.noAttendanceData')
  }

  return `${new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 1,
  }).format(percentage)}%`
}

function ProfileSetup({
  onSaved,
}: {
  onSaved: (schoolType: SchoolType) => void
}) {
  const [selectedSchoolType, setSelectedSchoolType] = useState<SchoolType | ''>(
    '',
  )
  const [saveError, setSaveError] = useState(false)
  const profilePreset =
    selectedSchoolType === ''
      ? undefined
      : getSchoolProfilePreset(selectedSchoolType)

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault()
    const result = SchoolTypeSchema.safeParse(selectedSchoolType)
    if (!result.success) {
      return
    }

    try {
      saveSchoolTypePreference(window.localStorage, result.data)
      onSaved(result.data)
    } catch {
      setSaveError(true)
    }
  }

  return (
    <section className={styles['card']} aria-labelledby="profile-title">
      <h2 id="profile-title" className={styles['sectionTitle']}>
        {t('dashboard.profileSetupTitle')}
      </h2>
      <p>{t('dashboard.profileSetupExplanation')}</p>
      <form onSubmit={submit}>
        <label className={styles['fieldLabel']} htmlFor="school-type">
          {t('dashboard.schoolTypeLabel')}
        </label>
        <select
          className={styles['select']}
          id="school-type"
          onChange={(event) => {
            const result = SchoolTypeSchema.safeParse(event.currentTarget.value)
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
                critical: profilePreset.profile.attendance.criticalThreshold,
                warning: profilePreset.profile.attendance.warningThreshold,
              })}
            </p>
            <p>{t('dashboard.presetScope')}</p>
            <p className={styles['verifyNotice']}>
              {t('dashboard.verifyPreset')}
            </p>
          </div>
        )}

        {saveError ? (
          <p className={styles['error']} role="alert">
            {t('dashboard.profileSaveError')}
          </p>
        ) : null}
        <button
          className={styles['primaryButton']}
          disabled={selectedSchoolType === ''}
          type="submit"
        >
          {t('dashboard.confirmProfile')}
        </button>
      </form>
    </section>
  )
}

function DashboardContent({
  schoolType,
  onChangeProfile,
}: {
  schoolType: SchoolType
  onChangeProfile: () => void
}) {
  const attendanceQuery = useQuery({
    queryKey: ATTENDANCE_QUERY_KEY,
    queryFn: apiClient.getAttendance,
  })
  const profilePreset = getSchoolProfilePreset(schoolType)

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
    profilePreset.profile,
  )
  const overall = summary.overall.year
  const orderedSubjects = [...summary.subjects].sort((first, second) => {
    if (first.year.percentage === null) {
      return second.year.percentage === null
        ? first.subject.localeCompare(second.subject, 'pl')
        : 1
    }
    if (second.year.percentage === null) {
      return -1
    }
    return (
      first.year.percentage - second.year.percentage ||
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
        <button className={styles['secondaryButton']} onClick={onChangeProfile}>
          {t('dashboard.changeSchoolType')}
        </button>
      </header>

      <p className={styles['presetNotice']}>
        {t('dashboard.activePreset', {
          schoolType: t(SCHOOL_TYPE_TRANSLATION_KEYS[schoolType]),
          label: profilePreset.label,
        })}
      </p>

      <section
        className={styles['overallCard']}
        aria-labelledby="overall-title"
      >
        <h2 id="overall-title">{t('dashboard.overallAttendance')}</h2>
        <p className={styles['overallValue']}>
          {formatPercentage(overall.percentage)}
        </p>
        <p>
          {t('dashboard.lessonCount', {
            present: overall.presentLessons,
            counted: overall.countedLessons,
          })}
        </p>
        <div className={styles['semesterGrid']}>
          <p>
            <span>{t('dashboard.semesterOne')}</span>
            <strong>
              {formatPercentage(summary.overall.semester1.percentage)}
            </strong>
          </p>
          <p>
            <span>{t('dashboard.semesterTwo')}</span>
            <strong>
              {formatPercentage(summary.overall.semester2.percentage)}
            </strong>
          </p>
        </div>
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
                      present: subject.year.presentLessons,
                      counted: subject.year.countedLessons,
                    })}
                  </p>
                </div>
                <strong>{formatPercentage(subject.year.percentage)}</strong>
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
  const schoolTypeQuery = useQuery({
    queryKey: SCHOOL_TYPE_QUERY_KEY,
    queryFn: () => readSchoolTypePreference(window.localStorage),
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

  if (schoolTypeQuery.isPending) {
    return (
      <main className={styles['page']}>
        <p role="status">{t('dashboard.loading')}</p>
      </main>
    )
  }

  if (schoolTypeQuery.error instanceof InvalidSchoolTypePreferenceError) {
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
                clearSchoolTypePreference(window.localStorage)
                queryClient.setQueryData(SCHOOL_TYPE_QUERY_KEY, null)
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

  if (schoolTypeQuery.isError) {
    return (
      <main className={styles['page']}>
        <p className={styles['error']} role="alert">
          {t('dashboard.profileLoadError')}
        </p>
      </main>
    )
  }

  const schoolType = schoolTypeQuery.data
  if (schoolType === null || isEditingProfile) {
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
          onSaved={(selectedType) => {
            queryClient.setQueryData(SCHOOL_TYPE_QUERY_KEY, selectedType)
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
        schoolType={schoolType}
        onChangeProfile={() => {
          setIsEditingProfile(true)
        }}
      />
    </main>
  )
}
