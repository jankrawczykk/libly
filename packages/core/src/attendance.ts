import type {
  AttendanceEntry,
  AttendanceRules,
  SchoolProfile,
  SubjectRule,
} from './index.js'

export type AttendanceStatus = 'critical' | 'warning' | 'ok' | 'unknown'

export type AttendanceThresholds = Pick<
  AttendanceRules,
  'criticalThreshold' | 'warningThreshold'
>

export function classifyAttendanceStatus(
  percentage: number | null,
  thresholds: AttendanceThresholds,
  subjectRule?: Pick<
    SubjectRule,
    'attendanceCriticalThreshold' | 'attendanceWarningThreshold'
  >,
): AttendanceStatus {
  if (percentage === null) {
    return 'unknown'
  }

  const criticalThreshold =
    subjectRule?.attendanceCriticalThreshold ?? thresholds.criticalThreshold
  const warningThreshold =
    subjectRule?.attendanceWarningThreshold ?? thresholds.warningThreshold

  if (percentage < criticalThreshold) {
    return 'critical'
  }
  if (percentage < warningThreshold) {
    return 'warning'
  }
  return 'ok'
}

export interface AttendancePercentage {
  presentLessons: number
  countedLessons: number
  percentage: number | null
}

export interface AttendancePeriodSummary {
  year: AttendancePercentage
  semester1: AttendancePercentage
  semester2: AttendancePercentage
}

export interface AttendanceSubjectSummary extends AttendancePeriodSummary {
  subject: string
}

export interface AttendanceSummary {
  overall: AttendancePeriodSummary
  subjects: AttendanceSubjectSummary[]
}

export function calculateAttendanceSummary(
  entries: readonly AttendanceEntry[],
  profile: Pick<SchoolProfile, 'attendance' | 'subjectRules'>,
): AttendanceSummary {
  const excludedKinds = new Set(profile.attendance.excludedKinds)
  const countLateAsPresent = profile.attendance.countLateAsPresent
  const countExcusedAsPresent = profile.attendance.countExcusedAsPresent

  function summarize(
    selectedEntries: readonly AttendanceEntry[],
  ): AttendancePercentage {
    let countedLessons = 0
    let presentLessons = 0

    for (const entry of selectedEntries) {
      if (excludedKinds.has(entry.kind)) {
        continue
      }

      countedLessons += 1
      if (
        entry.kind === 'present' ||
        (entry.kind === 'late' && countLateAsPresent) ||
        (entry.kind === 'absent_excused' && countExcusedAsPresent)
      ) {
        presentLessons += 1
      }
    }

    return {
      presentLessons,
      countedLessons,
      percentage:
        countedLessons === 0 ? null : (presentLessons / countedLessons) * 100,
    }
  }

  function summarizePeriods(
    selectedEntries: readonly AttendanceEntry[],
  ): AttendancePeriodSummary {
    return {
      year: summarize(selectedEntries),
      semester1: summarize(
        selectedEntries.filter((entry) => entry.semester === 1),
      ),
      semester2: summarize(
        selectedEntries.filter((entry) => entry.semester === 2),
      ),
    }
  }

  const excludedSubjects = new Set(
    profile.subjectRules
      .filter((rule) => !rule.includeInOverallAttendance)
      .map((rule) => rule.subject),
  )
  const overallEntries = entries.filter(
    (entry) => !excludedSubjects.has(entry.subject),
  )
  const entriesBySubject = new Map<string, AttendanceEntry[]>()

  for (const entry of entries) {
    const subjectEntries = entriesBySubject.get(entry.subject) ?? []
    subjectEntries.push(entry)
    entriesBySubject.set(entry.subject, subjectEntries)
  }

  return {
    overall: summarizePeriods(overallEntries),
    subjects: Array.from(entriesBySubject, ([subject, subjectEntries]) => ({
      subject,
      ...summarizePeriods(subjectEntries),
    })),
  }
}
