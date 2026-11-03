import {
  ATTENDANCE_KINDS,
  AttendanceKindSchema,
  getSchoolProfilePreset,
  SchoolProfileSchema,
  SchoolTypeSchema,
  SUBJECT_CATEGORIES,
  SubjectCategorySchema,
  type AttendanceKind,
  type SchoolProfile,
  type SubjectCategory,
} from '@libly/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { apiClient } from '../../api/client.js'
import { t, type TranslationKey } from '../../i18n/index.js'
import {
  readSchoolProfilePreference,
  saveSchoolProfilePreference,
  SCHOOL_PROFILE_QUERY_KEY,
} from '../dashboard/school-type-storage.js'
import styles from './settings-page.module.css'

const SESSION_QUERY_KEY = ['session'] as const
const MAX_IMPORT_SIZE = 1_000_000
const SCHOOL_TYPE_TRANSLATION_KEYS = {
  primary: 'school.primary',
  general_lyceum: 'school.generalLyceum',
  technikum: 'school.technikum',
  vocational_stage1: 'school.vocationalStage1',
  vocational_stage2: 'school.vocationalStage2',
  post_secondary: 'school.postSecondary',
  other: 'school.other',
} as const satisfies Record<SchoolProfile['schoolType'], TranslationKey>

const ATTENDANCE_KIND_TRANSLATION_KEYS = {
  present: 'settings.kindPresent',
  late: 'settings.kindLate',
  absent_unexcused: 'settings.kindAbsentUnexcused',
  absent_excused: 'settings.kindAbsentExcused',
  exempt: 'settings.kindExempt',
  school_trip: 'settings.kindSchoolTrip',
  other: 'settings.kindOther',
} as const satisfies Record<AttendanceKind, TranslationKey>

const SUBJECT_CATEGORY_TRANSLATION_KEYS = {
  general: 'settings.categoryGeneral',
  vocational: 'settings.categoryVocational',
  practical_classes: 'settings.categoryPractical',
  work_placement: 'settings.categoryPlacement',
  physical_education: 'settings.categoryPhysicalEducation',
  religion_ethics: 'settings.categoryReligionEthics',
  behavior: 'settings.categoryBehavior',
  custom: 'settings.categoryCustom',
} as const satisfies Record<SubjectCategory, TranslationKey>

const ENUM_OPTIONS = {
  scope: [
    { value: 'per_subject', label: 'settings.scopePerSubject' },
    { value: 'overall', label: 'settings.scopeOverall' },
    { value: 'both', label: 'settings.scopeBoth' },
  ],
  period: [
    { value: 'semester', label: 'settings.periodSemester' },
    { value: 'year', label: 'settings.periodYear' },
  ],
  termType: [
    { value: 'semesters', label: 'settings.termSemesters' },
    { value: 'trimesters', label: 'settings.termTrimesters' },
    { value: 'custom', label: 'settings.termCustom' },
  ],
  scale: [
    { value: 'one_to_six', label: 'settings.scaleOneToSix' },
    { value: 'points', label: 'settings.scalePoints' },
    { value: 'percent', label: 'settings.scalePercent' },
    { value: 'custom', label: 'settings.scaleCustom' },
  ],
  averageMethod: [
    { value: 'weighted', label: 'settings.averageWeighted' },
    { value: 'arithmetic', label: 'settings.averageArithmetic' },
  ],
  handling: [
    { value: 'exclude_from_average', label: 'settings.handlingExclude' },
    { value: 'include_as_subject', label: 'settings.handlingInclude' },
    { value: 'separate_average', label: 'settings.handlingSeparate' },
  ],
} as const

type SettingsOption = { value: string; label: TranslationKey }

function classNames(...names: (string | undefined)[]): string {
  return names.filter((name): name is string => name !== undefined).join(' ')
}

function withoutSymbol(
  symbolMap: Record<string, AttendanceKind>,
  removedSymbol: string,
): Record<string, AttendanceKind> {
  return Object.fromEntries(
    Object.entries(symbolMap).filter(([symbol]) => symbol !== removedSymbol),
  )
}

function Field({
  label,
  type = 'text',
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  type?: 'text' | 'number' | 'date'
  value: string | number
  min?: number
  max?: number
  step?: number
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className={styles['field']}>
      <label htmlFor={id}>{label}</label>
      <input
        className={styles['control']}
        id={id}
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          onChange(event.currentTarget.value)
        }}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly SettingsOption[]
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className={styles['field']}>
      <label htmlFor={id}>
        {label}
        <select
          className={styles['control']}
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.currentTarget.value)
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={styles['checkField']}>
      <input
        checked={checked}
        type="checkbox"
        onChange={(event) => {
          onChange(event.currentTarget.checked)
        }}
      />
      <span>{label}</span>
    </label>
  )
}

function SettingsForm({ initialProfile }: { initialProfile: SchoolProfile }) {
  const queryClient = useQueryClient()
  const importInput = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState(initialProfile)
  const [saveMessage, setSaveMessage] = useState<TranslationKey | ''>('')
  const [importMessage, setImportMessage] = useState<TranslationKey | ''>('')
  const [newSymbol, setNewSymbol] = useState('')
  const [newSymbolKind, setNewSymbolKind] = useState<AttendanceKind>('present')

  function updateProfile(update: (current: SchoolProfile) => SchoolProfile) {
    setProfile(update)
    setSaveMessage('')
    setImportMessage('')
  }

  function saveProfile(): void {
    const result = SchoolProfileSchema.safeParse(profile)
    if (!result.success) {
      setSaveMessage('settings.invalidProfile')
      return
    }

    try {
      saveSchoolProfilePreference(window.localStorage, result.data)
      queryClient.setQueryData(SCHOOL_PROFILE_QUERY_KEY, result.data)
      setProfile(result.data)
      setSaveMessage('settings.saved')
    } catch (error) {
      if (!(error instanceof DOMException)) {
        throw error
      }
      setSaveMessage('settings.saveError')
    }
  }

  function resetToPreset(): void {
    const preset = getSchoolProfilePreset(profile.schoolType)
    setProfile(preset.profile)
    setSaveMessage('settings.presetRestored')
    setImportMessage('')
  }

  function exportProfile(): void {
    const result = SchoolProfileSchema.safeParse(profile)
    if (!result.success) {
      setSaveMessage('settings.invalidProfile')
      return
    }

    const file = new Blob([JSON.stringify(result.data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'libly-school-profile.json'
    document.body.append(link)
    try {
      link.click()
    } finally {
      link.remove()
    }
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 0)
  }

  async function importProfile(file: File | undefined): Promise<void> {
    if (file === undefined) {
      return
    }
    if (file.size > MAX_IMPORT_SIZE) {
      setImportMessage('settings.importTooLarge')
      return
    }

    let fileContents: string
    try {
      fileContents = await file.text()
    } catch (error) {
      if (!(error instanceof DOMException)) {
        throw error
      }
      setImportMessage('settings.importReadError')
      return
    }

    let importedProfile: unknown
    try {
      importedProfile = JSON.parse(fileContents)
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error
      }
      setImportMessage('settings.importInvalid')
      return
    }
    const result = SchoolProfileSchema.safeParse(importedProfile)
    if (!result.success) {
      setImportMessage('settings.importInvalid')
      return
    }
    setProfile(result.data)
    setSaveMessage('')
    setImportMessage('settings.importReady')
  }

  const subjectCategoryOptions = SUBJECT_CATEGORIES.map((category) => ({
    value: category,
    label: SUBJECT_CATEGORY_TRANSLATION_KEYS[category],
  }))
  const isSaveError =
    saveMessage === 'settings.invalidProfile' ||
    saveMessage === 'settings.saveError' ||
    saveMessage === 'settings.symbolDuplicate'
  const attendanceKindOptions = ATTENDANCE_KINDS.map((kind) => ({
    value: kind,
    label: ATTENDANCE_KIND_TRANSLATION_KEYS[kind],
  }))
  const schoolTypeOptions = Object.entries(SCHOOL_TYPE_TRANSLATION_KEYS).map(
    ([value, label]) => ({ value, label }),
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        saveProfile()
      }}
    >
      <section className={styles['section']} aria-labelledby="school-section">
        <h2 id="school-section">{t('settings.schoolSection')}</h2>
        <div className={styles['fieldGrid']}>
          <SelectField
            label={t('settings.schoolType')}
            value={profile.schoolType}
            options={schoolTypeOptions}
            onChange={(value) => {
              const result = SchoolTypeSchema.safeParse(value)
              if (result.success) {
                updateProfile((current) => ({
                  ...current,
                  schoolType: result.data,
                }))
              }
            }}
          />
          <Field
            label={t('settings.classYear')}
            type="number"
            min={1}
            step={1}
            value={profile.classYear ?? ''}
            onChange={(value) => {
              updateProfile((current) => ({
                ...current,
                classYear: value === '' ? undefined : Number(value),
              }))
            }}
          />
        </div>
        <p className={styles['helpText']}>{t('settings.schoolTypeHelp')}</p>
      </section>

      <section
        className={styles['section']}
        aria-labelledby="attendance-section"
      >
        <h2 id="attendance-section">{t('settings.attendanceSection')}</h2>
        <div className={styles['fieldGrid']}>
          <Field
            label={t('settings.criticalThreshold')}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={profile.attendance.criticalThreshold}
            onChange={(value) => {
              updateProfile((current) => ({
                ...current,
                attendance: {
                  ...current.attendance,
                  criticalThreshold: Number(value),
                },
              }))
            }}
          />
          <Field
            label={t('settings.warningThreshold')}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={profile.attendance.warningThreshold}
            onChange={(value) => {
              updateProfile((current) => ({
                ...current,
                attendance: {
                  ...current.attendance,
                  warningThreshold: Number(value),
                },
              }))
            }}
          />
          <SelectField
            label={t('settings.scope')}
            value={profile.attendance.scope}
            options={ENUM_OPTIONS.scope}
            onChange={(value) => {
              if (
                value === 'per_subject' ||
                value === 'overall' ||
                value === 'both'
              ) {
                updateProfile((current) => ({
                  ...current,
                  attendance: { ...current.attendance, scope: value },
                }))
              }
            }}
          />
          <SelectField
            label={t('settings.evaluationPeriod')}
            value={profile.attendance.period}
            options={ENUM_OPTIONS.period}
            onChange={(value) => {
              if (value === 'semester' || value === 'year') {
                updateProfile((current) => ({
                  ...current,
                  attendance: { ...current.attendance, period: value },
                }))
              }
            }}
          />
        </div>
        <CheckboxField
          label={t('settings.countLate')}
          checked={profile.attendance.countLateAsPresent}
          onChange={(checked) => {
            updateProfile((current) => ({
              ...current,
              attendance: {
                ...current.attendance,
                countLateAsPresent: checked,
              },
            }))
          }}
        />
        <CheckboxField
          label={t('settings.countExcused')}
          checked={profile.attendance.countExcusedAsPresent}
          onChange={(checked) => {
            updateProfile((current) => ({
              ...current,
              attendance: {
                ...current.attendance,
                countExcusedAsPresent: checked,
              },
            }))
          }}
        />
        <fieldset>
          <legend className={styles['legend']}>
            {t('settings.excludedKinds')}
          </legend>
          {ATTENDANCE_KINDS.map((kind) => (
            <CheckboxField
              key={kind}
              label={t(ATTENDANCE_KIND_TRANSLATION_KEYS[kind])}
              checked={profile.attendance.excludedKinds.includes(kind)}
              onChange={(checked) => {
                updateProfile((current) => ({
                  ...current,
                  attendance: {
                    ...current.attendance,
                    excludedKinds: checked
                      ? [...current.attendance.excludedKinds, kind]
                      : current.attendance.excludedKinds.filter(
                          (excludedKind) => excludedKind !== kind,
                        ),
                  },
                }))
              }}
            />
          ))}
        </fieldset>
        <div className={styles['subsection']}>
          <h3>{t('settings.symbolMap')}</h3>
          <p className={styles['helpText']}>{t('settings.symbolMapHelp')}</p>
          {Object.entries(profile.attendance.symbolMap).map(
            ([symbol, kind]) => (
              <div
                className={classNames(styles['row'], styles['symbolRow'])}
                key={symbol}
              >
                <Field
                  label={t('settings.symbol')}
                  value={symbol}
                  onChange={(newValue) => {
                    const normalizedSymbol = newValue.trim()
                    if (
                      normalizedSymbol !== symbol &&
                      Object.hasOwn(
                        profile.attendance.symbolMap,
                        normalizedSymbol,
                      )
                    ) {
                      setSaveMessage('settings.symbolDuplicate')
                      return
                    }
                    updateProfile((current) => {
                      const symbolMap = withoutSymbol(
                        current.attendance.symbolMap,
                        symbol,
                      )
                      return {
                        ...current,
                        attendance: {
                          ...current.attendance,
                          symbolMap:
                            normalizedSymbol === ''
                              ? symbolMap
                              : { ...symbolMap, [normalizedSymbol]: kind },
                        },
                      }
                    })
                  }}
                />
                <SelectField
                  label={t('settings.symbolKind')}
                  value={kind}
                  options={attendanceKindOptions}
                  onChange={(value) => {
                    const result = AttendanceKindSchema.safeParse(value)
                    if (result.success) {
                      updateProfile((current) => ({
                        ...current,
                        attendance: {
                          ...current.attendance,
                          symbolMap: {
                            ...current.attendance.symbolMap,
                            [symbol]: result.data,
                          },
                        },
                      }))
                    }
                  }}
                />
                <button
                  className={classNames(
                    styles['button'],
                    styles['dangerButton'],
                  )}
                  onClick={() => {
                    updateProfile((current) => ({
                      ...current,
                      attendance: {
                        ...current.attendance,
                        symbolMap: withoutSymbol(
                          current.attendance.symbolMap,
                          symbol,
                        ),
                      },
                    }))
                  }}
                  type="button"
                >
                  {t('settings.remove')}
                </button>
              </div>
            ),
          )}
          <div className={classNames(styles['row'], styles['symbolRow'])}>
            <Field
              label={t('settings.newSymbol')}
              value={newSymbol}
              onChange={setNewSymbol}
            />
            <SelectField
              label={t('settings.symbolKind')}
              value={newSymbolKind}
              options={attendanceKindOptions}
              onChange={(value) => {
                const result = AttendanceKindSchema.safeParse(value)
                if (result.success) {
                  setNewSymbolKind(result.data)
                }
              }}
            />
            <button
              className={styles['button']}
              disabled={
                newSymbol.trim() === '' ||
                Object.hasOwn(profile.attendance.symbolMap, newSymbol.trim())
              }
              onClick={() => {
                const symbol = newSymbol.trim()
                if (symbol === '') {
                  return
                }
                updateProfile((current) => ({
                  ...current,
                  attendance: {
                    ...current.attendance,
                    symbolMap: {
                      ...current.attendance.symbolMap,
                      [symbol]: newSymbolKind,
                    },
                  },
                }))
                setNewSymbol('')
              }}
              type="button"
            >
              {t('settings.add')}
            </button>
          </div>
        </div>
      </section>

      <section className={styles['section']} aria-labelledby="grades-section">
        <h2 id="grades-section">{t('settings.gradesSection')}</h2>
        <div className={styles['fieldGrid']}>
          <SelectField
            label={t('settings.scale')}
            value={profile.grades.scale}
            options={ENUM_OPTIONS.scale}
            onChange={(value) => {
              if (
                value === 'one_to_six' ||
                value === 'points' ||
                value === 'percent' ||
                value === 'custom'
              ) {
                updateProfile((current) => ({
                  ...current,
                  grades: { ...current.grades, scale: value },
                }))
              }
            }}
          />
          <Field
            label={t('settings.plusOffset')}
            type="number"
            step={0.01}
            value={profile.grades.plusOffset}
            onChange={(value) => {
              updateProfile((current) => ({
                ...current,
                grades: { ...current.grades, plusOffset: Number(value) },
              }))
            }}
          />
          <Field
            label={t('settings.minusOffset')}
            type="number"
            step={0.01}
            value={profile.grades.minusOffset}
            onChange={(value) => {
              updateProfile((current) => ({
                ...current,
                grades: { ...current.grades, minusOffset: Number(value) },
              }))
            }}
          />
          <SelectField
            label={t('settings.averageMethod')}
            value={profile.grades.averageMethod}
            options={ENUM_OPTIONS.averageMethod}
            onChange={(value) => {
              if (value === 'weighted' || value === 'arithmetic') {
                updateProfile((current) => ({
                  ...current,
                  grades: { ...current.grades, averageMethod: value },
                }))
              }
            }}
          />
          <Field
            label={t('settings.distinctionAverage')}
            type="number"
            step={0.01}
            value={profile.grades.distinctionAverage}
            onChange={(value) => {
              updateProfile((current) => ({
                ...current,
                grades: {
                  ...current.grades,
                  distinctionAverage: Number(value),
                },
              }))
            }}
          />
          <Field
            label={t('settings.distinctionBehavior')}
            value={profile.grades.distinctionMinBehavior}
            onChange={(value) => {
              updateProfile((current) => ({
                ...current,
                grades: {
                  ...current.grades,
                  distinctionMinBehavior: value,
                },
              }))
            }}
          />
        </div>
        <CheckboxField
          label={t('settings.includeBehavior')}
          checked={profile.grades.includeBehaviorInAverage}
          onChange={(checked) => {
            updateProfile((current) => ({
              ...current,
              grades: {
                ...current.grades,
                includeBehaviorInAverage: checked,
              },
            }))
          }}
        />
        <div className={styles['fieldGrid']}>
          <SelectField
            label={t('settings.workPlacementHandling')}
            value={profile.grades.workPlacementHandling}
            options={ENUM_OPTIONS.handling}
            onChange={(value) => {
              if (
                value === 'exclude_from_average' ||
                value === 'include_as_subject' ||
                value === 'separate_average'
              ) {
                updateProfile((current) => ({
                  ...current,
                  grades: { ...current.grades, workPlacementHandling: value },
                }))
              }
            }}
          />
          <SelectField
            label={t('settings.practicalHandling')}
            value={profile.grades.practicalClassesHandling}
            options={ENUM_OPTIONS.handling}
            onChange={(value) => {
              if (
                value === 'exclude_from_average' ||
                value === 'include_as_subject' ||
                value === 'separate_average'
              ) {
                updateProfile((current) => ({
                  ...current,
                  grades: {
                    ...current.grades,
                    practicalClassesHandling: value,
                  },
                }))
              }
            }}
          />
        </div>
      </section>

      <section className={styles['section']} aria-labelledby="terms-section">
        <h2 id="terms-section">{t('settings.termsSection')}</h2>
        <SelectField
          label={t('settings.termType')}
          value={profile.terms.type}
          options={ENUM_OPTIONS.termType}
          onChange={(value) => {
            if (
              value === 'semesters' ||
              value === 'trimesters' ||
              value === 'custom'
            ) {
              updateProfile((current) => ({
                ...current,
                terms: { ...current.terms, type: value },
              }))
            }
          }}
        />
        <p className={styles['helpText']}>{t('settings.termsHelp')}</p>
        {profile.terms.terms.map((term, index) => (
          <div className={styles['row']} key={String(index)}>
            <Field
              label={t('settings.termName')}
              value={term.name}
              onChange={(value) => {
                updateProfile((current) => ({
                  ...current,
                  terms: {
                    ...current.terms,
                    terms: current.terms.terms.map((currentTerm, termIndex) =>
                      termIndex === index
                        ? { ...currentTerm, name: value }
                        : currentTerm,
                    ),
                  },
                }))
              }}
            />
            <Field
              label={t('settings.termStart')}
              type="date"
              value={term.start}
              onChange={(value) => {
                updateProfile((current) => ({
                  ...current,
                  terms: {
                    ...current.terms,
                    terms: current.terms.terms.map((currentTerm, termIndex) =>
                      termIndex === index
                        ? { ...currentTerm, start: value }
                        : currentTerm,
                    ),
                  },
                }))
              }}
            />
            <Field
              label={t('settings.termEnd')}
              type="date"
              value={term.end}
              onChange={(value) => {
                updateProfile((current) => ({
                  ...current,
                  terms: {
                    ...current.terms,
                    terms: current.terms.terms.map((currentTerm, termIndex) =>
                      termIndex === index
                        ? { ...currentTerm, end: value }
                        : currentTerm,
                    ),
                  },
                }))
              }}
            />
            <button
              className={classNames(styles['button'], styles['dangerButton'])}
              onClick={() => {
                updateProfile((current) => ({
                  ...current,
                  terms: {
                    ...current.terms,
                    terms: current.terms.terms.filter(
                      (_, termIndex) => termIndex !== index,
                    ),
                  },
                }))
              }}
              type="button"
            >
              {t('settings.remove')}
            </button>
          </div>
        ))}
        <button
          className={styles['button']}
          onClick={() => {
            updateProfile((current) => ({
              ...current,
              terms: {
                ...current.terms,
                terms: [
                  ...current.terms.terms,
                  { name: '', start: '', end: '' },
                ],
              },
            }))
          }}
          type="button"
        >
          {t('settings.addTerm')}
        </button>
      </section>

      <section className={styles['section']} aria-labelledby="subjects-section">
        <h2 id="subjects-section">{t('settings.subjectRulesSection')}</h2>
        <p className={styles['helpText']}>{t('settings.subjectRulesHelp')}</p>
        {profile.subjectRules.map((rule, index) => (
          <div className={styles['section']} key={String(index)}>
            <div className={styles['fieldGrid']}>
              <Field
                label={t('settings.subjectName')}
                value={rule.subject}
                onChange={(value) => {
                  updateProfile((current) => ({
                    ...current,
                    subjectRules: current.subjectRules.map(
                      (currentRule, ruleIndex) =>
                        ruleIndex === index
                          ? { ...currentRule, subject: value }
                          : currentRule,
                    ),
                  }))
                }}
              />
              <SelectField
                label={t('settings.subjectCategory')}
                value={rule.category}
                options={subjectCategoryOptions}
                onChange={(value) => {
                  const result = SubjectCategorySchema.safeParse(value)
                  if (result.success) {
                    updateProfile((current) => ({
                      ...current,
                      subjectRules: current.subjectRules.map(
                        (currentRule, ruleIndex) =>
                          ruleIndex === index
                            ? { ...currentRule, category: result.data }
                            : currentRule,
                      ),
                    }))
                  }
                }}
              />
              <Field
                label={t('settings.subjectCriticalThreshold')}
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={rule.attendanceCriticalThreshold ?? ''}
                onChange={(value) => {
                  updateProfile((current) => ({
                    ...current,
                    subjectRules: current.subjectRules.map(
                      (currentRule, ruleIndex) =>
                        ruleIndex === index
                          ? {
                              ...currentRule,
                              attendanceCriticalThreshold:
                                value === '' ? undefined : Number(value),
                            }
                          : currentRule,
                    ),
                  }))
                }}
              />
              <Field
                label={t('settings.subjectWarningThreshold')}
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={rule.attendanceWarningThreshold ?? ''}
                onChange={(value) => {
                  updateProfile((current) => ({
                    ...current,
                    subjectRules: current.subjectRules.map(
                      (currentRule, ruleIndex) =>
                        ruleIndex === index
                          ? {
                              ...currentRule,
                              attendanceWarningThreshold:
                                value === '' ? undefined : Number(value),
                            }
                          : currentRule,
                    ),
                  }))
                }}
              />
              <Field
                label={t('settings.weightMultiplier')}
                type="number"
                min={0.01}
                step={0.01}
                value={rule.weightMultiplier ?? ''}
                onChange={(value) => {
                  updateProfile((current) => ({
                    ...current,
                    subjectRules: current.subjectRules.map(
                      (currentRule, ruleIndex) =>
                        ruleIndex === index
                          ? {
                              ...currentRule,
                              weightMultiplier:
                                value === '' ? undefined : Number(value),
                            }
                          : currentRule,
                    ),
                  }))
                }}
              />
            </div>
            <CheckboxField
              label={t('settings.includeSubjectAttendance')}
              checked={rule.includeInOverallAttendance}
              onChange={(checked) => {
                updateProfile((current) => ({
                  ...current,
                  subjectRules: current.subjectRules.map(
                    (currentRule, ruleIndex) =>
                      ruleIndex === index
                        ? {
                            ...currentRule,
                            includeInOverallAttendance: checked,
                          }
                        : currentRule,
                  ),
                }))
              }}
            />
            <CheckboxField
              label={t('settings.includeSubjectAverage')}
              checked={rule.includeInOverallAverage}
              onChange={(checked) => {
                updateProfile((current) => ({
                  ...current,
                  subjectRules: current.subjectRules.map(
                    (currentRule, ruleIndex) =>
                      ruleIndex === index
                        ? { ...currentRule, includeInOverallAverage: checked }
                        : currentRule,
                  ),
                }))
              }}
            />
            <button
              className={classNames(styles['button'], styles['dangerButton'])}
              onClick={() => {
                updateProfile((current) => ({
                  ...current,
                  subjectRules: current.subjectRules.filter(
                    (_, ruleIndex) => ruleIndex !== index,
                  ),
                }))
              }}
              type="button"
            >
              {t('settings.remove')}
            </button>
          </div>
        ))}
        <button
          className={styles['button']}
          onClick={() => {
            updateProfile((current) => ({
              ...current,
              subjectRules: [
                ...current.subjectRules,
                {
                  subject: '',
                  category: 'custom',
                  includeInOverallAverage: true,
                  includeInOverallAttendance: true,
                },
              ],
            }))
          }}
          type="button"
        >
          {t('settings.addSubjectRule')}
        </button>
      </section>

      <div className={styles['actions']}>
        <button
          className={classNames(styles['button'], styles['primaryButton'])}
          type="submit"
        >
          {t('settings.save')}
        </button>
        <button
          className={styles['button']}
          onClick={resetToPreset}
          type="button"
        >
          {t('settings.resetPreset')}
        </button>
        <button
          className={styles['button']}
          onClick={exportProfile}
          type="button"
        >
          {t('settings.export')}
        </button>
        <button
          className={styles['button']}
          onClick={() => importInput.current?.click()}
          type="button"
        >
          {t('settings.import')}
        </button>
        <input
          aria-hidden="true"
          accept="application/json,.json"
          className={styles['fileInput']}
          ref={importInput}
          tabIndex={-1}
          type="file"
          onChange={(event) => {
            void importProfile(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
      </div>
      {saveMessage ? (
        <p
          className={isSaveError ? styles['error'] : undefined}
          role={isSaveError ? 'alert' : 'status'}
        >
          {t(saveMessage)}
        </p>
      ) : null}
      {importMessage ? (
        <p
          className={
            importMessage === 'settings.importReady'
              ? undefined
              : styles['error']
          }
          role={importMessage === 'settings.importReady' ? 'status' : 'alert'}
        >
          {t(importMessage)}
        </p>
      ) : null}
    </form>
  )
}

export function SettingsPage() {
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: apiClient.getSession,
  })
  const profileQuery = useQuery({
    queryKey: SCHOOL_PROFILE_QUERY_KEY,
    queryFn: () => readSchoolProfilePreference(window.localStorage),
    enabled: sessionQuery.data?.authenticated === true,
    staleTime: Infinity,
  })

  if (sessionQuery.isPending) {
    return (
      <main className={styles['page']}>
        <p role="status">{t('settings.loading')}</p>
      </main>
    )
  }
  if (sessionQuery.isError || !sessionQuery.data.authenticated) {
    return <Navigate to="/" replace />
  }
  if (profileQuery.isPending) {
    return (
      <main className={styles['page']}>
        <p role="status">{t('settings.loading')}</p>
      </main>
    )
  }
  if (profileQuery.isError) {
    return (
      <main className={styles['page']}>
        <p className={styles['error']} role="alert">
          {t('settings.profileLoadError')}
        </p>
        <Link className={styles['link']} to="/dashboard">
          {t('settings.backToDashboard')}
        </Link>
      </main>
    )
  }

  if (profileQuery.data === null) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className={styles['page']}>
      <header className={styles['header']}>
        <div>
          <p className={styles['helpText']}>{t('app.title')}</p>
          <h1>{t('settings.title')}</h1>
          <p className={styles['helpText']}>{t('settings.presetWarning')}</p>
        </div>
        <Link className={styles['link']} to="/dashboard">
          {t('settings.backToDashboard')}
        </Link>
      </header>
      <SettingsForm initialProfile={profileQuery.data} />
    </main>
  )
}
