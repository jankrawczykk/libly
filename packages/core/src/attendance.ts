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

export interface AttendanceSimulationInput {
  additionalPresentLessons: number
  additionalAbsentLessons: number
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

export type AbsenceBuffer =
  | { kind: 'unavailable' }
  | { kind: 'unlimited' }
  | { kind: 'finite'; lessons: number }

export type RecoveryRequirement =
  | { kind: 'unavailable' }
  | { kind: 'impossible' }
  | { kind: 'finite'; lessons: number }

type AttendanceCounts = Pick<
  AttendancePercentage,
  'presentLessons' | 'countedLessons'
>

function getThresholdFraction(thresholdPercent: number): number {
  if (
    !Number.isFinite(thresholdPercent) ||
    thresholdPercent < 0 ||
    thresholdPercent > 100
  ) {
    throw new RangeError('Attendance threshold must be between 0 and 100')
  }

  return thresholdPercent / 100
}

function validateAttendanceCounts({
  presentLessons,
  countedLessons,
}: AttendanceCounts): void {
  if (
    !Number.isInteger(presentLessons) ||
    !Number.isInteger(countedLessons) ||
    presentLessons < 0 ||
    countedLessons < 0 ||
    presentLessons > countedLessons
  ) {
    throw new RangeError(
      'Attendance lesson counts must be non-negative integers with present lessons no greater than counted lessons',
    )
  }
}

function validateSimulationInput({
  additionalPresentLessons,
  additionalAbsentLessons,
}: AttendanceSimulationInput): void {
  if (
    !Number.isInteger(additionalPresentLessons) ||
    !Number.isInteger(additionalAbsentLessons) ||
    additionalPresentLessons < 0 ||
    additionalAbsentLessons < 0
  ) {
    throw new RangeError(
      'Simulated lesson counts must be non-negative integers',
    )
  }
}

export function simulateAttendance(
  attendance: AttendanceCounts,
  simulation: AttendanceSimulationInput,
): AttendancePercentage {
  validateAttendanceCounts(attendance)
  validateSimulationInput(simulation)

  const countedLessons =
    attendance.countedLessons +
    simulation.additionalPresentLessons +
    simulation.additionalAbsentLessons
  const presentLessons =
    attendance.presentLessons + simulation.additionalPresentLessons

  return {
    presentLessons,
    countedLessons,
    percentage:
      countedLessons === 0 ? null : (presentLessons / countedLessons) * 100,
  }
}

export function calculateAbsenceBuffer(
  attendance: AttendanceCounts,
  thresholdPercent: number,
): AbsenceBuffer {
  validateAttendanceCounts(attendance)
  const threshold = getThresholdFraction(thresholdPercent)

  if (threshold === 0) {
    return { kind: 'unlimited' }
  }
  if (attendance.countedLessons === 0) {
    return { kind: 'unavailable' }
  }

  const currentPercentage =
    attendance.presentLessons / attendance.countedLessons
  if (currentPercentage < threshold) {
    return { kind: 'finite', lessons: 0 }
  }

  return {
    kind: 'finite',
    lessons: Math.max(
      0,
      Math.floor(
        attendance.presentLessons / threshold - attendance.countedLessons,
      ),
    ),
  }
}

export function calculateRecoveryRequirement(
  attendance: AttendanceCounts,
  thresholdPercent: number,
): RecoveryRequirement {
  validateAttendanceCounts(attendance)
  const threshold = getThresholdFraction(thresholdPercent)

  if (attendance.countedLessons === 0) {
    return { kind: 'unavailable' }
  }

  const currentPercentage =
    attendance.presentLessons / attendance.countedLessons
  if (currentPercentage >= threshold) {
    return { kind: 'finite', lessons: 0 }
  }
  if (threshold === 1) {
    return { kind: 'impossible' }
  }

  return {
    kind: 'finite',
    lessons: Math.ceil(
      (threshold * attendance.countedLessons - attendance.presentLessons) /
        (1 - threshold),
    ),
  }
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
