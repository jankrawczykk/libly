import { describe, expect, test } from 'vitest'
import {
  AttendanceEntry,
  classifyAttendanceStatus,
  calculateAbsenceBuffer,
  calculateAttendanceSummary,
  calculateRecoveryRequirement,
  calculateAttendanceTrend,
  getSchoolProfilePreset,
  simulateAttendance,
} from '../src/index.js'

const profile = getSchoolProfilePreset('other').profile

describe('classifyAttendanceStatus', () => {
  const thresholds = {
    criticalThreshold: 50,
    warningThreshold: 60,
  }

  test('returns unknown when no percentage can be calculated', () => {
    expect(classifyAttendanceStatus(null, thresholds)).toBe('unknown')
  })

  test('classifies percentages below both thresholds as critical', () => {
    expect(classifyAttendanceStatus(0, thresholds)).toBe('critical')
    expect(classifyAttendanceStatus(49.99, thresholds)).toBe('critical')
  })

  test('treats the exact critical threshold as warning', () => {
    expect(classifyAttendanceStatus(50, thresholds)).toBe('warning')
  })

  test('classifies percentages between thresholds as warning', () => {
    expect(classifyAttendanceStatus(55, thresholds)).toBe('warning')
    expect(classifyAttendanceStatus(59.99, thresholds)).toBe('warning')
  })

  test('treats the exact warning threshold as okay', () => {
    expect(classifyAttendanceStatus(60, thresholds)).toBe('ok')
    expect(classifyAttendanceStatus(100, thresholds)).toBe('ok')
  })

  test('uses per-subject threshold overrides independently', () => {
    const subjectRule = {
      attendanceCriticalThreshold: 40,
      attendanceWarningThreshold: 70,
    }

    expect(classifyAttendanceStatus(45, thresholds, subjectRule)).toBe(
      'warning',
    )
    expect(
      classifyAttendanceStatus(55, thresholds, {
        attendanceCriticalThreshold: 60,
      }),
    ).toBe('critical')
    expect(
      classifyAttendanceStatus(55, thresholds, {
        attendanceWarningThreshold: 55,
      }),
    ).toBe('ok')
  })
})

describe('simulateAttendance', () => {
  test('applies hypothetical presents and absences to the current counts', () => {
    expect(
      simulateAttendance(
        { presentLessons: 6, countedLessons: 10 },
        { additionalPresentLessons: 2, additionalAbsentLessons: 1 },
      ),
    ).toEqual({
      presentLessons: 8,
      countedLessons: 13,
      percentage: (8 / 13) * 100,
    })
  })

  test('returns null for a simulation with no counted lessons', () => {
    expect(
      simulateAttendance(
        { presentLessons: 0, countedLessons: 0 },
        { additionalPresentLessons: 0, additionalAbsentLessons: 0 },
      ),
    ).toEqual({
      presentLessons: 0,
      countedLessons: 0,
      percentage: null,
    })
  })

  test('rejects invalid simulated lesson counts', () => {
    expect(() =>
      simulateAttendance(
        { presentLessons: 1, countedLessons: 2 },
        { additionalPresentLessons: -1, additionalAbsentLessons: 0 },
      ),
    ).toThrow(RangeError)
  })
})

describe('calculateAbsenceBuffer', () => {
  test('returns unavailable when there are no counted lessons', () => {
    expect(
      calculateAbsenceBuffer({ presentLessons: 0, countedLessons: 0 }, 50),
    ).toEqual({ kind: 'unavailable' })
  })

  test('returns unlimited when the threshold is zero', () => {
    expect(
      calculateAbsenceBuffer({ presentLessons: 0, countedLessons: 10 }, 0),
    ).toEqual({ kind: 'unlimited' })
  })

  test('calculates the maximum absences that keep attendance at threshold', () => {
    expect(
      calculateAbsenceBuffer({ presentLessons: 8, countedLessons: 10 }, 50),
    ).toEqual({ kind: 'finite', lessons: 6 })
  })

  test('floors the buffer while preserving the threshold', () => {
    expect(
      calculateAbsenceBuffer({ presentLessons: 7, countedLessons: 10 }, 60),
    ).toEqual({ kind: 'finite', lessons: 1 })
  })

  test('returns zero when attendance is already below the threshold', () => {
    expect(
      calculateAbsenceBuffer({ presentLessons: 4, countedLessons: 10 }, 50),
    ).toEqual({ kind: 'finite', lessons: 0 })
  })

  test('does not allow another absence at a 100 percent threshold', () => {
    expect(
      calculateAbsenceBuffer({ presentLessons: 10, countedLessons: 10 }, 100),
    ).toEqual({ kind: 'finite', lessons: 0 })
  })
})

describe('calculateRecoveryRequirement', () => {
  test('returns unavailable when there are no counted lessons', () => {
    expect(
      calculateRecoveryRequirement(
        { presentLessons: 0, countedLessons: 0 },
        50,
      ),
    ).toEqual({ kind: 'unavailable' })
  })

  test('returns zero when attendance is already at or above threshold', () => {
    expect(
      calculateRecoveryRequirement(
        { presentLessons: 6, countedLessons: 10 },
        50,
      ),
    ).toEqual({ kind: 'finite', lessons: 0 })
    expect(
      calculateRecoveryRequirement(
        { presentLessons: 8, countedLessons: 10 },
        50,
      ),
    ).toEqual({ kind: 'finite', lessons: 0 })
  })

  test('calculates lessons needed to recover to the threshold', () => {
    expect(
      calculateRecoveryRequirement(
        { presentLessons: 3, countedLessons: 10 },
        50,
      ),
    ).toEqual({ kind: 'finite', lessons: 4 })
  })

  test('returns impossible for a 100 percent threshold with any absence', () => {
    expect(
      calculateRecoveryRequirement(
        { presentLessons: 9, countedLessons: 10 },
        100,
      ),
    ).toEqual({ kind: 'impossible' })
  })

  test('returns zero for a zero threshold', () => {
    expect(
      calculateRecoveryRequirement(
        { presentLessons: 0, countedLessons: 10 },
        0,
      ),
    ).toEqual({ kind: 'finite', lessons: 0 })
  })

  test('rejects invalid counts and thresholds', () => {
    expect(() =>
      calculateRecoveryRequirement(
        { presentLessons: 11, countedLessons: 10 },
        50,
      ),
    ).toThrow(RangeError)
    expect(() =>
      calculateAbsenceBuffer({ presentLessons: 0, countedLessons: 0 }, 101),
    ).toThrow(RangeError)
  })
})

function entry(overrides: Partial<AttendanceEntry> = {}): AttendanceEntry {
  return {
    date: '2026-09-01',
    lessonNumber: 1,
    subject: 'Matematyka',
    kind: 'present',
    rawSymbol: 'obecny',
    semester: 1,
    ...overrides,
  }
}

describe('calculateAttendanceSummary', () => {
  test('calculates whole-year and per-semester percentages overall and per subject', () => {
    const summary = calculateAttendanceSummary(
      [
        entry({ subject: 'Matematyka', kind: 'present', semester: 1 }),
        entry({ subject: 'Matematyka', kind: 'absent_unexcused', semester: 1 }),
        entry({ subject: 'Historia', kind: 'present', semester: 2 }),
        entry({
          subject: 'Historia',
          kind: 'absent_unexcused',
          semester: 2,
        }),
      ],
      profile,
    )

    expect(summary.overall.year).toEqual({
      presentLessons: 2,
      countedLessons: 4,
      percentage: 50,
    })

    expect(summary.overall.semester1).toEqual({
      presentLessons: 1,
      countedLessons: 2,
      percentage: 50,
    })
    expect(summary.overall.semester2).toEqual({
      presentLessons: 1,
      countedLessons: 2,
      percentage: 50,
    })
    expect(summary.subjects).toEqual([
      {
        subject: 'Matematyka',
        year: { presentLessons: 1, countedLessons: 2, percentage: 50 },
        semester1: { presentLessons: 1, countedLessons: 2, percentage: 50 },
        semester2: { presentLessons: 0, countedLessons: 0, percentage: null },
      },
      {
        subject: 'Historia',
        year: { presentLessons: 1, countedLessons: 2, percentage: 50 },
        semester1: { presentLessons: 0, countedLessons: 0, percentage: null },
        semester2: { presentLessons: 1, countedLessons: 2, percentage: 50 },
      },
    ])
  })

  test('returns null when no lessons are counted', () => {
    const summary = calculateAttendanceSummary(
      [entry({ kind: 'exempt' }), entry({ kind: 'school_trip' })],
      profile,
    )

    expect(summary.overall.year).toEqual({
      presentLessons: 0,
      countedLessons: 0,
      percentage: null,
    })
    expect(summary.subjects[0]?.year.percentage).toBeNull()
  })

  test('returns 100 percent for all present lessons and zero for all absences', () => {
    const allPresent = calculateAttendanceSummary(
      [entry(), entry({ lessonNumber: 2 })],
      profile,
    )
    const allAbsent = calculateAttendanceSummary(
      [
        entry({ kind: 'absent_unexcused' }),
        entry({ kind: 'other', lessonNumber: 2 }),
      ],
      profile,
    )

    expect(allPresent.overall.year.percentage).toBe(100)
    expect(allAbsent.overall.year.percentage).toBe(0)
  })

  test('counts late and excused lessons according to their independent settings', () => {
    const lateEntry = [entry({ kind: 'late' })]
    const excusedEntry = [entry({ kind: 'absent_excused' })]

    expect(
      calculateAttendanceSummary(lateEntry, profile).overall.year.percentage,
    ).toBe(100)
    expect(
      calculateAttendanceSummary(excusedEntry, profile).overall.year.percentage,
    ).toBe(0)
    expect(
      calculateAttendanceSummary(lateEntry, {
        ...profile,
        attendance: { ...profile.attendance, countLateAsPresent: false },
      }).overall.year.percentage,
    ).toBe(0)
    expect(
      calculateAttendanceSummary(excusedEntry, {
        ...profile,
        attendance: { ...profile.attendance, countExcusedAsPresent: true },
      }).overall.year.percentage,
    ).toBe(100)
  })

  test('excludes configured kinds from the denominator', () => {
    const summary = calculateAttendanceSummary(
      [entry({ kind: 'present' }), entry({ kind: 'school_trip' })],
      profile,
    )

    expect(summary.overall.year).toEqual({
      presentLessons: 1,
      countedLessons: 1,
      percentage: 100,
    })
  })

  describe('calculateAttendanceTrend', () => {
    test('returns cumulative points by date for one subject', () => {
      expect(
        calculateAttendanceTrend(
          [
            entry({ date: '2026-09-02', kind: 'absent_unexcused' }),
            entry({ date: '2026-09-01', kind: 'present' }),
            entry({
              date: '2026-09-02',
              lessonNumber: 2,
              kind: 'present',
            }),
          ],
          profile,
          'Matematyka',
        ),
      ).toEqual([
        {
          date: '2026-09-01',
          presentLessons: 1,
          countedLessons: 1,
          percentage: 100,
        },
        {
          date: '2026-09-02',
          presentLessons: 2,
          countedLessons: 3,
          percentage: (2 / 3) * 100,
        },
      ])
    })

    test('excludes configured kinds and ignores other subjects', () => {
      expect(
        calculateAttendanceTrend(
          [
            entry({ kind: 'exempt' }),
            entry({ kind: 'present', subject: 'Historia' }),
            entry({ date: '2026-09-02', kind: 'absent_unexcused' }),
          ],
          profile,
          'Matematyka',
        ),
      ).toEqual([
        {
          date: '2026-09-01',
          presentLessons: 0,
          countedLessons: 0,
          percentage: null,
        },
        {
          date: '2026-09-02',
          presentLessons: 0,
          countedLessons: 1,
          percentage: 0,
        },
      ])
    })
  })

  test('excludes configured subjects from overall percentages but retains their own summaries', () => {
    const summary = calculateAttendanceSummary(
      [
        entry({ subject: 'Matematyka', kind: 'present' }),
        entry({ subject: 'WF', kind: 'absent_unexcused' }),
      ],
      {
        ...profile,
        subjectRules: [
          {
            subject: 'WF',
            category: 'physical_education',
            includeInOverallAverage: true,
            includeInOverallAttendance: false,
          },
        ],
      },
    )

    expect(summary.overall.year).toEqual({
      presentLessons: 1,
      countedLessons: 1,
      percentage: 100,
    })
    expect(
      summary.subjects.find(({ subject }) => subject === 'WF')?.year,
    ).toEqual({
      presentLessons: 0,
      countedLessons: 1,
      percentage: 0,
    })
  })

  test('returns the raw ratio without display rounding', () => {
    const summary = calculateAttendanceSummary(
      [
        entry({ kind: 'present' }),
        entry({ kind: 'present' }),
        entry({ kind: 'absent_unexcused' }),
      ],
      profile,
    )

    expect(summary.overall.year.percentage).toBe((2 / 3) * 100)
  })
})
