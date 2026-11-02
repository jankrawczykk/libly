import {
  generateSyntheticSchoolYear,
  type AttendanceEntry,
  type Grade,
  type SyntheticSchoolYearConfig,
} from '@libly/core'
import type { LibrusPort } from './librus-port.js'

const DEMO_SCHOOL_YEAR = {
  seed: 2026,
  semesters: [
    { start: '2025-09-01', end: '2026-01-30' },
    { start: '2026-02-02', end: '2026-06-26' },
  ],
  subjects: [
    {
      name: 'Przedmiot demonstracyjny A',
      category: 'general',
      lessonsPerWeek: 3,
      gradesPerSemester: 5,
    },
    {
      name: 'Przedmiot demonstracyjny B',
      category: 'general',
      lessonsPerWeek: 2,
      gradesPerSemester: 4,
    },
    {
      name: 'Zajęcia demonstracyjne',
      category: 'practical_classes',
      lessonsPerWeek: 2,
      gradesPerSemester: 3,
    },
  ],
  gradeRange: { minimum: 1, maximum: 6 },
  gradeOffsets: { plus: 0.5, minus: -0.25 },
} as const satisfies SyntheticSchoolYearConfig

export class DemoAdapter implements LibrusPort {
  private readonly attendance: AttendanceEntry[]
  private readonly grades: Grade[]

  constructor() {
    const schoolYear = generateSyntheticSchoolYear(DEMO_SCHOOL_YEAR)
    this.attendance = schoolYear.attendance
    this.grades = schoolYear.grades
  }

  getAttendance(): Promise<readonly AttendanceEntry[]> {
    return Promise.resolve(this.attendance.map((entry) => ({ ...entry })))
  }

  getGrades(): Promise<readonly Grade[]> {
    return Promise.resolve(this.grades.map((grade) => ({ ...grade })))
  }
}
