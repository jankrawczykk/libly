import { describe, expect, test } from 'vitest'
import {
  AttendanceEntrySchema,
  generateSyntheticSchoolYear,
  GradeSchema,
  SyntheticSchoolYearConfigSchema,
} from '../src/index.js'

const config = {
  seed: 2026,
  semesters: [
    { start: '2025-09-01', end: '2026-01-30' },
    { start: '2026-02-02', end: '2026-06-26' },
  ],
  subjects: [
    {
      name: 'Przedmiot testowy A',
      category: 'general',
      lessonsPerWeek: 3,
      gradesPerSemester: 5,
    },
    {
      name: 'Przedmiot testowy B',
      category: 'work_placement',
      lessonsPerWeek: 2,
      gradesPerSemester: 4,
    },
  ],
  gradeRange: { minimum: 1, maximum: 6 },
  gradeOffsets: { plus: 0.5, minus: -0.25 },
} as const

describe('generateSyntheticSchoolYear', () => {
  test('generates validated attendance and grades across both configured semesters', () => {
    const generated = generateSyntheticSchoolYear(config)

    expect(generated.attendance.length).toBeGreaterThan(100)
    expect(generated.grades).toHaveLength(18)
    expect(
      generated.attendance.every(
        (entry) => AttendanceEntrySchema.safeParse(entry).success,
      ),
    ).toBe(true)
    expect(
      generated.grades.every((grade) => GradeSchema.safeParse(grade).success),
    ).toBe(true)
    expect(generated.attendance.some((entry) => entry.semester === 1)).toBe(
      true,
    )
    expect(generated.attendance.some((entry) => entry.semester === 2)).toBe(
      true,
    )
    expect(
      generated.attendance.every((entry) =>
        entry.rawSymbol.startsWith('synthetic_'),
      ),
    ).toBe(true)
    expect(
      new Set(generated.attendance.map((entry) => entry.kind)).size,
    ).toBeGreaterThan(1)
    expect(generated.grades.some((grade) => grade.semester === 1)).toBe(true)
    expect(generated.grades.some((grade) => grade.semester === 2)).toBe(true)
    expect(
      generated.grades.some(
        (grade) => grade.value === null && !grade.countsToAverage,
      ),
    ).toBe(true)
  })

  test('is deterministic for the same seed and configuration', () => {
    expect(generateSyntheticSchoolYear(config)).toEqual(
      generateSyntheticSchoolYear(config),
    )
  })

  test('generates weekdays within configured semester dates only', () => {
    const generated = generateSyntheticSchoolYear(config)

    for (const entry of generated.attendance) {
      const semesterRange = config.semesters[entry.semester === 1 ? 0 : 1]
      expect(entry.date >= semesterRange.start).toBe(true)
      expect(entry.date <= semesterRange.end).toBe(true)
      const weekday = new Date(`${entry.date}T00:00:00.000Z`).getUTCDay()
      expect(weekday).not.toBe(0)
      expect(weekday).not.toBe(6)
    }
  })

  test('supports different grade ranges and offsets without assuming a school scale', () => {
    const generated = generateSyntheticSchoolYear({
      ...config,
      seed: 7,
      gradeRange: { minimum: 0, maximum: 100 },
      gradeOffsets: { plus: 2, minus: -3 },
    })

    expect(
      generated.grades
        .filter((grade) => grade.value !== null)
        .every((grade) => grade.value !== null && grade.value >= -3),
    ).toBe(true)
    expect(
      generated.grades.some(
        (grade) => grade.rawValue.endsWith('+') || grade.rawValue.endsWith('-'),
      ),
    ).toBe(true)
  })

  test('rejects invalid semester ranges and duplicate subjects', () => {
    expect(
      SyntheticSchoolYearConfigSchema.safeParse({
        ...config,
        semesters: [
          config.semesters[0],
          { start: '2026-01-01', end: '2026-06-26' },
        ],
      }).success,
    ).toBe(false)
    expect(
      SyntheticSchoolYearConfigSchema.safeParse({
        ...config,
        subjects: [config.subjects[0], config.subjects[0]],
      }).success,
    ).toBe(false)
  })

  test('rejects a date range longer than a school year', () => {
    expect(
      SyntheticSchoolYearConfigSchema.safeParse({
        ...config,
        semesters: [
          config.semesters[0],
          { start: '2026-02-02', end: '2026-09-10' },
        ],
      }).success,
    ).toBe(false)
  })

  test('rejects a semester that contains no weekdays', () => {
    expect(() =>
      generateSyntheticSchoolYear({
        ...config,
        semesters: [
          { start: '2026-01-03', end: '2026-01-04' },
          config.semesters[1],
        ],
      }),
    ).toThrow(RangeError)
  })
})
