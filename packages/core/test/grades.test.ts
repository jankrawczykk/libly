import { describe, expect, test } from 'vitest'
import {
  calculateGradeSummary,
  calculateTargetGrade,
  getSchoolProfilePreset,
  Grade,
} from '../src/index.js'

const profile = getSchoolProfilePreset('other').profile

function grade(overrides: Partial<Grade> = {}): Grade {
  return {
    subject: 'Matematyka',
    value: 4,
    rawValue: '4',
    weight: 1,
    category: 'general',
    date: '2026-09-01',
    semester: 1,
    countsToAverage: true,
    ...overrides,
  }
}

describe('calculateGradeSummary', () => {
  test('calculates weighted averages by year, semester, and subject', () => {
    const summary = calculateGradeSummary(
      [
        grade({ value: 4, weight: 2, semester: 1 }),
        grade({ value: 2, weight: 1, semester: 1 }),
        grade({
          subject: 'Historia',
          value: 5,
          weight: 1,
          semester: 2,
          category: 'general',
        }),
      ],
      profile,
    )

    expect(summary.overall.year).toEqual({
      sum: 15,
      weight: 4,
      average: 3.75,
    })
    expect(summary.overall.semester1.average).toBe(10 / 3)
    expect(summary.overall.semester2.average).toBe(5)
    expect(summary.subjects[0]?.year.average).toBe(10 / 3)
    expect(summary.subjects[1]?.year.average).toBe(5)
  })

  test('returns null when no countable numeric grades are present', () => {
    const summary = calculateGradeSummary(
      [
        grade({ countsToAverage: false }),
        grade({ value: null, rawValue: 'opisowa' }),
        grade({ value: null, rawValue: 'np', countsToAverage: false }),
        grade({ value: null, rawValue: 'bz', countsToAverage: false }),
        grade({ value: null, rawValue: 'nb', countsToAverage: false }),
      ],
      profile,
    )

    expect(summary.overall.year.average).toBeNull()
    expect(summary.overall.year.weight).toBe(0)
    expect(summary.subjects[0]?.year.average).toBeNull()
  })

  test('applies configurable plus and minus offsets based on raw values', () => {
    const summary = calculateGradeSummary(
      [
        grade({ value: 4.5, rawValue: '4+' }),
        grade({ value: 2.75, rawValue: '3-' }),
      ],
      profile,
    )

    expect(summary.overall.year.average).toBe(3.625)
  })

  test('supports arithmetic averaging when selected in the profile', () => {
    const summary = calculateGradeSummary(
      [grade({ value: 6, weight: 5 }), grade({ value: 2, weight: 1 })],
      {
        ...profile,
        grades: { ...profile.grades, averageMethod: 'arithmetic' },
      },
    )

    expect(summary.overall.year).toEqual({
      sum: 8,
      weight: 2,
      average: 4,
    })
  })

  test('excludes non-countable categories and subjects from the overall average', () => {
    const summary = calculateGradeSummary(
      [
        grade({ subject: 'Matematyka', value: 4 }),
        grade({ subject: 'Zachowanie', value: 6, category: 'behavior' }),
        grade({
          subject: 'WF',
          value: 2,
          category: 'physical_education',
        }),
      ],
      {
        ...profile,
        subjectRules: [
          {
            subject: 'WF',
            category: 'physical_education',
            includeInOverallAttendance: true,
            includeInOverallAverage: false,
          },
        ],
      },
    )

    expect(summary.overall.year.average).toBe(4)
    expect(summary.subjects).toHaveLength(3)
    expect(summary.subjects[1]?.year.average).toBe(6)
  })

  test('includes behavior grades in the overall average only when configured', () => {
    const grades = [
      grade({ subject: 'Matematyka', value: 4, category: 'general' }),
      grade({ subject: 'Zachowanie', value: 6, category: 'behavior' }),
    ]

    const included = calculateGradeSummary(grades, {
      ...profile,
      grades: { ...profile.grades, includeBehaviorInAverage: true },
    })

    expect(included.overall.year.average).toBe(5)
    expect(included.subjects[1]?.year.average).toBe(6)
  })

  test('includes custom categories in overall averages unless a profile rule excludes them', () => {
    const summary = calculateGradeSummary(
      [
        grade({ subject: 'Matematyka', value: 4, category: 'general' }),
        grade({
          subject: 'Custom subject',
          value: 2,
          category: 'custom-school-category',
        }),
      ],
      profile,
    )

    expect(summary.overall.year.average).toBe(3)
  })

  test('honors configured work placement and practical class handling', () => {
    const vocationalProfile = getSchoolProfilePreset('technikum').profile
    const grades = [
      grade({ subject: 'Matematyka', value: 4, category: 'general' }),
      grade({
        subject: 'Praktyki',
        value: 2,
        category: 'work_placement',
      }),
      grade({
        subject: 'Pracownia',
        value: 6,
        category: 'practical_classes',
        semester: 2,
      }),
    ]
    const summary = calculateGradeSummary(grades, vocationalProfile)

    expect(summary.overall.year.average).toBe(4)
    expect(summary.separate.workPlacement?.year.average).toBe(2)
    expect(summary.separate.practicalClasses?.year.average).toBe(6)
  })

  test('excludes vocational categories from the main average when configured', () => {
    const summary = calculateGradeSummary(
      [
        grade({ subject: 'Matematyka', value: 4, category: 'general' }),
        grade({
          subject: 'Praktyki',
          value: 2,
          category: 'work_placement',
        }),
        grade({
          subject: 'Pracownia',
          value: 6,
          category: 'practical_classes',
        }),
      ],
      profile,
    )

    expect(summary.overall.year.average).toBe(4)
    expect(summary.separate.workPlacement).toBeNull()
    expect(summary.separate.practicalClasses).toBeNull()
  })

  test('includes vocational categories in the main average when configured as subjects', () => {
    const summary = calculateGradeSummary(
      [
        grade({ subject: 'Matematyka', value: 4, category: 'general' }),
        grade({
          subject: 'Praktyki',
          value: 2,
          category: 'work_placement',
        }),
        grade({
          subject: 'Pracownia',
          value: 6,
          category: 'practical_classes',
        }),
      ],
      {
        ...profile,
        grades: {
          ...profile.grades,
          workPlacementHandling: 'include_as_subject',
          practicalClassesHandling: 'include_as_subject',
        },
      },
    )

    expect(summary.overall.year.average).toBe(4)
    expect(summary.separate.workPlacement).toBeNull()
    expect(summary.separate.practicalClasses).toBeNull()
  })
})

describe('calculateTargetGrade', () => {
  test('calculates the needed weighted grade and reachability on the 1–6 scale', () => {
    expect(
      calculateTargetGrade({ sum: 14, weight: 4 }, 4, 2, {
        averageMethod: 'weighted',
        scale: 'one_to_six',
      }),
    ).toEqual({ requiredValue: 5, reachable: true })
  })

  test('reports a target outside the selected grading scale as unreachable', () => {
    expect(
      calculateTargetGrade({ sum: 4, weight: 1 }, 6, 1, {
        averageMethod: 'weighted',
        scale: 'one_to_six',
      }),
    ).toEqual({ requiredValue: 8, reachable: false })
  })

  test('uses the percentage scale bounds for reachability', () => {
    expect(
      calculateTargetGrade({ sum: 40, weight: 1 }, 100, 1, {
        averageMethod: 'weighted',
        scale: 'percent',
      }),
    ).toEqual({ requiredValue: 160, reachable: false })
  })

  test('returns unknown reachability when the scale has no configured bounds', () => {
    expect(
      calculateTargetGrade({ sum: 2, weight: 1 }, 4, 1, {
        averageMethod: 'weighted',
        scale: 'points',
      }),
    ).toEqual({ requiredValue: 6, reachable: null })
  })

  test('uses unit weight for arithmetic averages', () => {
    expect(
      calculateTargetGrade({ sum: 8, weight: 2 }, 4, 3, {
        averageMethod: 'arithmetic',
        scale: 'one_to_six',
      }),
    ).toEqual({ requiredValue: 4, reachable: true })
  })

  test('rejects invalid weights and accumulators', () => {
    expect(() =>
      calculateTargetGrade({ sum: 0, weight: -1 }, 4, 1, {
        averageMethod: 'weighted',
        scale: 'one_to_six',
      }),
    ).toThrow(RangeError)
  })
})
