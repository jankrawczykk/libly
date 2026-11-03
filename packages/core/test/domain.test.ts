import { describe, expect, test } from 'vitest'
import {
  AttendanceEntrySchema,
  AttendanceRulesSchema,
  CURRENT_SCHOOL_PROFILE_VERSION,
  GradeSchema,
  GradeRulesSchema,
  migrateSchoolProfile,
  SchoolProfileSchema,
  SubjectRuleSchema,
  suggestSubjectCategory,
  TermStructureSchema,
  UnsupportedSchoolProfileVersionError,
} from '../src/index.js'

const validProfile = {
  version: CURRENT_SCHOOL_PROFILE_VERSION,
  schoolType: 'other',
  attendance: {
    criticalThreshold: 50,
    warningThreshold: 60,
    scope: 'both',
    period: 'year',
    countLateAsPresent: true,
    countExcusedAsPresent: false,
    excludedKinds: ['exempt', 'school_trip'],
    symbolMap: { obecny: 'present', nieobecny: 'absent_unexcused' },
  },
  grades: {
    scale: 'custom',
    plusOffset: 0.5,
    minusOffset: -0.25,
    averageMethod: 'weighted',
    includeBehaviorInAverage: false,
    distinctionAverage: 4.75,
    distinctionMinBehavior: 'bardzo dobre',
    workPlacementHandling: 'separate_average',
    practicalClassesHandling: 'include_as_subject',
  },
  terms: {
    type: 'custom',
    terms: [
      { name: 'Okres 1', start: '2026-09-01', end: '2027-01-31' },
      { name: 'Okres 2', start: '2027-02-01', end: '2027-06-30' },
    ],
  },
  subjectRules: [
    {
      subject: 'Przedmiot testowy',
      category: 'general',
      includeInOverallAverage: true,
      includeInOverallAttendance: true,
      attendanceCriticalThreshold: 45,
      attendanceWarningThreshold: 55,
      weightMultiplier: 1,
    },
  ],
} as const

describe('domain schemas', () => {
  test('validates a complete school profile and its version', () => {
    expect(SchoolProfileSchema.parse(validProfile)).toEqual(validProfile)
  })

  test('validates normalized attendance and grade records', () => {
    expect(
      AttendanceEntrySchema.safeParse({
        date: '2026-09-01',
        lessonNumber: 1,
        subject: 'Przedmiot testowy',
        kind: 'present',
        rawSymbol: 'obecny',
        semester: 1,
      }).success,
    ).toBe(true)

    expect(
      GradeSchema.safeParse({
        subject: 'Przedmiot testowy',
        value: null,
        rawValue: 'opisowa',
        weight: 1,
        category: 'general',
        date: '2026-09-01',
        semester: 1,
        countsToAverage: false,
      }).success,
    ).toBe(true)
  })

  test('rejects invalid dates, unknown keys, and invalid school rule values', () => {
    expect(
      AttendanceEntrySchema.safeParse({
        date: '2026-02-30',
        lessonNumber: 0,
        subject: 'Przedmiot testowy',
        kind: 'present',
        rawSymbol: 'obecny',
        semester: 1,
      }).success,
    ).toBe(false)

    expect(
      SchoolProfileSchema.safeParse({
        ...validProfile,
        unexpected: true,
      }).success,
    ).toBe(false)

    expect(
      AttendanceRulesSchema.safeParse({
        ...validProfile.attendance,
        warningThreshold: 40,
      }).success,
    ).toBe(false)

    expect(
      SubjectRuleSchema.safeParse({
        ...validProfile.subjectRules[0],
        category: 'unrecognized',
      }).success,
    ).toBe(false)

    expect(
      GradeRulesSchema.safeParse({
        ...validProfile.grades,
        averageMethod: 'unrecognized',
      }).success,
    ).toBe(false)

    expect(
      TermStructureSchema.safeParse({
        type: 'custom',
        terms: [{ name: 'Invalid', start: '2027-02-01', end: '2027-01-31' }],
      }).success,
    ).toBe(false)
  })

  test('rejects subject thresholds that conflict with the profile defaults', () => {
    const profileWithCriticalOverride = {
      ...validProfile,
      subjectRules: [
        {
          subject: validProfile.subjectRules[0].subject,
          category: validProfile.subjectRules[0].category,
          includeInOverallAverage:
            validProfile.subjectRules[0].includeInOverallAverage,
          includeInOverallAttendance:
            validProfile.subjectRules[0].includeInOverallAttendance,
          attendanceCriticalThreshold: 70,
        },
      ],
    }

    expect(
      SchoolProfileSchema.safeParse(profileWithCriticalOverride).success,
    ).toBe(false)
  })

  test('allows an unconfigured term structure without inventing school dates', () => {
    expect(
      TermStructureSchema.safeParse({
        type: 'semesters',
        terms: [],
      }).success,
    ).toBe(true)
  })

  test('validates the current profile during migration', () => {
    expect(migrateSchoolProfile(validProfile)).toEqual(validProfile)
    expect(() => migrateSchoolProfile({ ...validProfile, version: 2 })).toThrow(
      UnsupportedSchoolProfileVersionError,
    )
    expect(() =>
      migrateSchoolProfile({ ...validProfile, schoolType: 'unknown' }),
    ).toThrow()
  })
})

describe('subject category suggestions', () => {
  test.each([
    ['Praktyki zawodowe', 'work_placement'],
    ['Zajęcia praktyczne', 'practical_classes'],
    ['WYCHOWANIE FIZYCZNE', 'physical_education'],
    ['WF', 'physical_education'],
    ['Religia', 'religion_ethics'],
    ['etyka', 'religion_ethics'],
    ['Zachowanie', 'behavior'],
  ] as const)('suggests a category for "%s"', (subject, category) => {
    expect(suggestSubjectCategory(subject)).toBe(category)
  })

  test('normalizes Polish characters and punctuation', () => {
    expect(suggestSubjectCategory('   ZAJĘCIA—PRAKTYCZNE ')).toBe(
      'practical_classes',
    )
  })

  test('returns null for names without a known keyword', () => {
    expect(suggestSubjectCategory('Matematyka')).toBeNull()
    expect(suggestSubjectCategory('')).toBeNull()
  })

  test('prefers the work placement category when both cues appear', () => {
    expect(
      suggestSubjectCategory('Zajęcia praktyczne podczas praktyk zawodowych'),
    ).toBe('work_placement')
  })
})
