import { z } from 'zod'
import primaryPreset from '../presets/primary.json' with { type: 'json' }
import generalLyceumPreset from '../presets/general_lyceum.json' with { type: 'json' }
import technikumPreset from '../presets/technikum.json' with { type: 'json' }
import vocationalStage1Preset from '../presets/vocational_stage1.json' with { type: 'json' }
import vocationalStage2Preset from '../presets/vocational_stage2.json' with { type: 'json' }
import postSecondaryPreset from '../presets/post_secondary.json' with { type: 'json' }
import otherPreset from '../presets/other.json' with { type: 'json' }

export const CURRENT_SCHOOL_PROFILE_VERSION = 1

const nonBlankString = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)

export const ATTENDANCE_KINDS = [
  'present',
  'late',
  'absent_unexcused',
  'absent_excused',
  'exempt',
  'school_trip',
  'other',
] as const

export const AttendanceKindSchema = z.enum(ATTENDANCE_KINDS)
export type AttendanceKind = z.infer<typeof AttendanceKindSchema>

export const AttendanceEntrySchema = z
  .object({
    date: z.iso.date(),
    lessonNumber: z.number().int().positive(),
    subject: nonBlankString,
    kind: AttendanceKindSchema,
    rawSymbol: nonBlankString,
    semester: z.union([z.literal(1), z.literal(2)]),
  })
  .strict()
export type AttendanceEntry = z.infer<typeof AttendanceEntrySchema>

export const GradeSchema = z
  .object({
    subject: nonBlankString,
    value: z.number().nullable(),
    rawValue: nonBlankString,
    weight: z.number().positive(),
    category: nonBlankString,
    date: z.iso.date(),
    semester: z.union([z.literal(1), z.literal(2)]),
    countsToAverage: z.boolean(),
  })
  .strict()
export type Grade = z.infer<typeof GradeSchema>

export const SCHOOL_TYPES = [
  'primary',
  'general_lyceum',
  'technikum',
  'vocational_stage1',
  'vocational_stage2',
  'post_secondary',
  'other',
] as const

export const SchoolTypeSchema = z.enum(SCHOOL_TYPES)
export type SchoolType = z.infer<typeof SchoolTypeSchema>

const SCHOOL_PROFILE_PRESETS: Record<SchoolType, unknown> = {
  primary: primaryPreset,
  general_lyceum: generalLyceumPreset,
  technikum: technikumPreset,
  vocational_stage1: vocationalStage1Preset,
  vocational_stage2: vocationalStage2Preset,
  post_secondary: postSecondaryPreset,
  other: otherPreset,
}

export const SUBJECT_CATEGORIES = [
  'general',
  'vocational',
  'practical_classes',
  'work_placement',
  'physical_education',
  'religion_ethics',
  'behavior',
  'custom',
] as const

export const SubjectCategorySchema = z.enum(SUBJECT_CATEGORIES)
export type SubjectCategory = z.infer<typeof SubjectCategorySchema>

export const SubjectRuleSchema = z
  .object({
    subject: nonBlankString,
    category: SubjectCategorySchema,
    includeInOverallAverage: z.boolean(),
    includeInOverallAttendance: z.boolean(),
    attendanceCriticalThreshold: z.number().min(0).max(100).optional(),
    attendanceWarningThreshold: z.number().min(0).max(100).optional(),
    weightMultiplier: z.number().positive().optional(),
  })
  .strict()
  .superRefine((rule, context) => {
    if (
      rule.attendanceCriticalThreshold !== undefined &&
      rule.attendanceWarningThreshold !== undefined &&
      rule.attendanceWarningThreshold < rule.attendanceCriticalThreshold
    ) {
      context.addIssue({
        code: 'custom',
        path: ['attendanceWarningThreshold'],
        message: 'Warning threshold must not be below the critical threshold',
      })
    }
  })
export type SubjectRule = z.infer<typeof SubjectRuleSchema>

export const AttendanceRulesSchema = z
  .object({
    criticalThreshold: z.number().min(0).max(100),
    warningThreshold: z.number().min(0).max(100),
    scope: z.enum(['per_subject', 'overall', 'both']),
    period: z.enum(['semester', 'year']),
    countLateAsPresent: z.boolean(),
    countExcusedAsPresent: z.boolean(),
    excludedKinds: z.array(AttendanceKindSchema),
    symbolMap: z.record(z.string().regex(/\S/), AttendanceKindSchema),
  })
  .strict()
  .superRefine((rules, context) => {
    if (rules.warningThreshold < rules.criticalThreshold) {
      context.addIssue({
        code: 'custom',
        path: ['warningThreshold'],
        message: 'Warning threshold must not be below the critical threshold',
      })
    }
  })
export type AttendanceRules = z.infer<typeof AttendanceRulesSchema>

export const GradeRulesSchema = z
  .object({
    scale: z.enum(['one_to_six', 'points', 'percent', 'custom']),
    plusOffset: z.number(),
    minusOffset: z.number(),
    averageMethod: z.enum(['weighted', 'arithmetic']),
    includeBehaviorInAverage: z.boolean(),
    distinctionAverage: z.number(),
    distinctionMinBehavior: nonBlankString,
    workPlacementHandling: z.enum([
      'exclude_from_average',
      'include_as_subject',
      'separate_average',
    ]),
    practicalClassesHandling: z.enum([
      'exclude_from_average',
      'include_as_subject',
      'separate_average',
    ]),
  })
  .strict()
export type GradeRules = z.infer<typeof GradeRulesSchema>

export const TermSchema = z
  .object({
    name: nonBlankString,
    start: z.iso.date(),
    end: z.iso.date(),
  })
  .strict()
  .superRefine((term, context) => {
    if (term.end < term.start) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Term end date must not be before its start date',
      })
    }
  })
export type Term = z.infer<typeof TermSchema>

export const TermStructureSchema = z
  .object({
    type: z.enum(['semesters', 'trimesters', 'custom']),
    terms: z.array(TermSchema),
  })
  .strict()
export type TermStructure = z.infer<typeof TermStructureSchema>

export const SchoolProfileSchema = z
  .object({
    version: z.literal(CURRENT_SCHOOL_PROFILE_VERSION),
    schoolType: SchoolTypeSchema,
    classYear: z.number().int().positive().optional(),
    attendance: AttendanceRulesSchema,
    grades: GradeRulesSchema,
    terms: TermStructureSchema,
    subjectRules: z.array(SubjectRuleSchema),
  })
  .strict()
export type SchoolProfile = z.infer<typeof SchoolProfileSchema>

export const SchoolProfilePresetSchema = z
  .object({
    label: nonBlankString,
    profile: SchoolProfileSchema,
  })
  .strict()
export type SchoolProfilePreset = z.infer<typeof SchoolProfilePresetSchema>

export class UnsupportedSchoolProfileVersionError extends Error {
  constructor() {
    super('School profile version is not supported')
    this.name = 'UnsupportedSchoolProfileVersionError'
  }
}

export function migrateSchoolProfile(input: unknown): SchoolProfile {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('version' in input) ||
    input.version !== CURRENT_SCHOOL_PROFILE_VERSION
  ) {
    throw new UnsupportedSchoolProfileVersionError()
  }

  return SchoolProfileSchema.parse(input)
}

export function getSchoolProfilePreset(
  schoolType: SchoolType,
): SchoolProfilePreset {
  const preset = SchoolProfilePresetSchema.parse(
    SCHOOL_PROFILE_PRESETS[schoolType],
  )

  if (preset.profile.schoolType !== schoolType) {
    throw new Error(
      'School profile preset does not match the requested school type',
    )
  }

  return preset
}
