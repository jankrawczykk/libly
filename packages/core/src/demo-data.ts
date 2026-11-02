import { z } from 'zod'
import type { AttendanceEntry, Grade } from './index.js'

const dateSchema = z.iso.date()
const nonBlankString = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)

const SemesterRangeSchema = z
  .object({
    start: dateSchema,
    end: dateSchema,
  })
  .strict()
  .superRefine((range, context) => {
    if (range.end < range.start) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Semester end date must not be before its start date',
      })
    }
  })

export const SyntheticSchoolYearConfigSchema = z
  .object({
    seed: z.number().int(),
    semesters: z.tuple([SemesterRangeSchema, SemesterRangeSchema]),
    subjects: z
      .array(
        z
          .object({
            name: nonBlankString,
            category: nonBlankString,
            lessonsPerWeek: z.number().int().min(1).max(5),
            gradesPerSemester: z.number().int().min(1).max(12),
          })
          .strict(),
      )
      .min(1),
    gradeRange: z
      .object({
        minimum: z.number(),
        maximum: z.number(),
      })
      .strict(),
    gradeOffsets: z
      .object({
        plus: z.number(),
        minus: z.number(),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, context) => {
    const [firstSemester, secondSemester] = config.semesters
    if (secondSemester.start <= firstSemester.end) {
      context.addIssue({
        code: 'custom',
        path: ['semesters', 1, 'start'],
        message: 'Second semester must start after the first semester ends',
      })
    }
    if (
      new Date(`${secondSemester.end}T00:00:00.000Z`).getTime() -
        new Date(`${firstSemester.start}T00:00:00.000Z`).getTime() >
      366 * 24 * 60 * 60 * 1000
    ) {
      context.addIssue({
        code: 'custom',
        path: ['semesters'],
        message: 'Synthetic school year must not exceed 366 days',
      })
    }

    if (config.gradeRange.maximum <= config.gradeRange.minimum) {
      context.addIssue({
        code: 'custom',
        path: ['gradeRange', 'maximum'],
        message: 'Maximum grade must be greater than minimum grade',
      })
    } else if (
      !Number.isFinite(config.gradeRange.maximum - config.gradeRange.minimum)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['gradeRange'],
        message: 'Grade range must have a finite span',
      })
    }

    const subjectNames = new Set<string>()
    let lessonsPerWeek = 0
    for (const [index, subject] of config.subjects.entries()) {
      const normalizedName = subject.name.trim().toLocaleLowerCase('pl')
      if (subjectNames.has(normalizedName)) {
        context.addIssue({
          code: 'custom',
          path: ['subjects', index, 'name'],
          message: 'Subject names must be unique',
        })
      }
      subjectNames.add(normalizedName)
      lessonsPerWeek += subject.lessonsPerWeek
    }

    if (lessonsPerWeek > 40) {
      context.addIssue({
        code: 'custom',
        path: ['subjects'],
        message: 'Synthetic weekly lesson count must not exceed 40',
      })
    }
  })

type ParsedSyntheticSchoolYearConfig = z.infer<
  typeof SyntheticSchoolYearConfigSchema
>

export type SyntheticSchoolYearConfig = Readonly<
  Omit<
    ParsedSyntheticSchoolYearConfig,
    'semesters' | 'subjects' | 'gradeRange' | 'gradeOffsets'
  >
> & {
  semesters: readonly [
    Readonly<ParsedSyntheticSchoolYearConfig['semesters'][0]>,
    Readonly<ParsedSyntheticSchoolYearConfig['semesters'][1]>,
  ]
  subjects: readonly Readonly<
    ParsedSyntheticSchoolYearConfig['subjects'][number]
  >[]
  gradeRange: Readonly<ParsedSyntheticSchoolYearConfig['gradeRange']>
  gradeOffsets: Readonly<ParsedSyntheticSchoolYearConfig['gradeOffsets']>
}

export interface SyntheticSchoolYear {
  attendance: AttendanceEntry[]
  grades: Grade[]
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function listSchoolDays(start: string, end: string): string[] {
  const schoolDays: string[] = []
  const current = new Date(`${start}T00:00:00.000Z`)
  const lastDay = new Date(`${end}T00:00:00.000Z`)

  while (current <= lastDay) {
    const dayOfWeek = current.getUTCDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      schoolDays.push(current.toISOString().slice(0, 10))
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return schoolDays
}

function getAttendanceKind(random: () => number): AttendanceEntry['kind'] {
  const outcome = random()
  if (outcome < 0.86) {
    return 'present'
  }
  if (outcome < 0.9) {
    return 'late'
  }
  if (outcome < 0.94) {
    return 'absent_excused'
  }
  if (outcome < 0.99) {
    return 'absent_unexcused'
  }
  return 'other'
}

function formatGradeValue(value: number): string {
  return Number(value.toFixed(2)).toString()
}

function createGrade(
  subject: SyntheticSchoolYearConfig['subjects'][number],
  date: string,
  semester: 1 | 2,
  config: SyntheticSchoolYearConfig,
  random: () => number,
): Grade {
  const weight = 1 + Math.floor(random() * 3)
  if (random() < 0.05) {
    const symbols = ['np', 'bz', 'nb']
    const rawValue = symbols[Math.floor(random() * symbols.length)] ?? 'np'
    return {
      subject: subject.name,
      value: null,
      rawValue,
      weight,
      category: subject.category,
      date,
      semester,
      countsToAverage: false,
    }
  }

  const { minimum, maximum } = config.gradeRange
  const baseValue = Number(
    (minimum + random() * (maximum - minimum)).toFixed(2),
  )
  const modifier = random() < 0.2 ? (random() < 0.5 ? '+' : '-') : ''
  const offset =
    modifier === '+'
      ? config.gradeOffsets.plus
      : modifier === '-'
        ? config.gradeOffsets.minus
        : 0
  const value = baseValue + offset
  if (!Number.isFinite(value)) {
    throw new RangeError('Generated grade value must be finite')
  }

  return {
    subject: subject.name,
    value,
    rawValue: `${formatGradeValue(baseValue)}${modifier}`,
    weight,
    category: subject.category,
    date,
    semester,
    countsToAverage: random() >= 0.08,
  }
}

export function generateSyntheticSchoolYear(
  input: SyntheticSchoolYearConfig,
): SyntheticSchoolYear {
  const config = SyntheticSchoolYearConfigSchema.parse(input)
  const random = createRandom(config.seed)
  const attendance: AttendanceEntry[] = []
  const grades: Grade[] = []
  const firstSemesterStart = new Date(
    `${config.semesters[0].start}T00:00:00.000Z`,
  ).getTime()
  const secondSemesterStart = new Date(
    `${config.semesters[1].start}T00:00:00.000Z`,
  ).getTime()

  for (const [semesterIndex, semesterRange] of config.semesters.entries()) {
    const semester: 1 | 2 = semesterIndex === 0 ? 1 : 2
    const semesterStart =
      semester === 1 ? firstSemesterStart : secondSemesterStart
    const semesterStartWeekday = (new Date(semesterStart).getUTCDay() + 6) % 7
    const firstWeekStart =
      semesterStart - semesterStartWeekday * 24 * 60 * 60 * 1000
    const schoolDays = listSchoolDays(semesterRange.start, semesterRange.end)
    if (schoolDays.length === 0) {
      throw new RangeError('Each semester must include at least one weekday')
    }

    for (const day of schoolDays) {
      const date = new Date(`${day}T00:00:00.000Z`)
      const weekday = (date.getUTCDay() + 6) % 7
      const week = Math.floor(
        (date.getTime() - firstWeekStart) / (7 * 24 * 60 * 60 * 1000),
      )
      let lessonNumber = 0

      for (const [subjectIndex, subject] of config.subjects.entries()) {
        for (let lesson = 0; lesson < subject.lessonsPerWeek; lesson += 1) {
          const targetWeekday = (week + subjectIndex + lesson * 2) % 5
          if (weekday !== targetWeekday) {
            continue
          }

          lessonNumber += 1
          const kind = getAttendanceKind(random)
          attendance.push({
            date: day,
            lessonNumber,
            subject: subject.name,
            kind,
            rawSymbol: `synthetic_${kind}`,
            semester,
          })
        }
      }
    }

    for (const subject of config.subjects) {
      for (let index = 0; index < subject.gradesPerSemester; index += 1) {
        const dateIndex = Math.floor(random() * schoolDays.length)
        const date = schoolDays[dateIndex]
        if (date === undefined) {
          throw new RangeError(
            'Each semester must include at least one weekday',
          )
        }
        grades.push(createGrade(subject, date, semester, config, random))
      }
    }
  }

  return { attendance, grades }
}
