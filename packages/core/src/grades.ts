import type { Grade, GradeRules, SchoolProfile } from './index.js'

export interface GradeAverage {
  sum: number
  weight: number
  average: number | null
}

export interface GradePeriodAverages {
  year: GradeAverage
  semester1: GradeAverage
  semester2: GradeAverage
}

export interface SubjectGradeAverages extends GradePeriodAverages {
  subject: string
}

export interface SeparateGradeAverages {
  workPlacement: GradePeriodAverages | null
  practicalClasses: GradePeriodAverages | null
}

export interface GradeSummary {
  overall: GradePeriodAverages
  subjects: SubjectGradeAverages[]
  separate: SeparateGradeAverages
}

export interface TargetGradeResult {
  requiredValue: number
  reachable: boolean | null
}

function getCategory(
  grade: Grade,
  profile: Pick<SchoolProfile, 'subjectRules'>,
): string {
  return (
    profile.subjectRules.find((rule) => rule.subject === grade.subject)
      ?.category ?? grade.category
  )
}

function getGradeValue(grade: Grade, rules: GradeRules): number | null {
  if (!grade.countsToAverage || grade.value === null) {
    return null
  }
  if (!Number.isFinite(grade.value)) {
    throw new RangeError('Grade value must be finite')
  }

  const modifier = /^([+-]?\d+(?:[.,]\d+)?)\s*([+-])$/.exec(
    grade.rawValue.trim(),
  )
  if (modifier === null) {
    return grade.value
  }

  const baseValue = Number(modifier[1]?.replace(',', '.'))
  const adjustedValue =
    baseValue + (modifier[2] === '+' ? rules.plusOffset : rules.minusOffset)
  if (!Number.isFinite(adjustedValue)) {
    throw new RangeError('Grade value must be finite')
  }

  return adjustedValue
}

function calculateAverage(
  grades: readonly Grade[],
  rules: GradeRules,
  subjectRules: Pick<SchoolProfile, 'subjectRules'>,
  includeBehavior: boolean,
): GradeAverage {
  let sum = 0
  let weight = 0

  for (const grade of grades) {
    if (!includeBehavior && getCategory(grade, subjectRules) === 'behavior') {
      continue
    }

    const value = getGradeValue(grade, rules)
    if (value === null) {
      continue
    }

    const gradeWeight = rules.averageMethod === 'weighted' ? grade.weight : 1
    if (!Number.isFinite(gradeWeight) || gradeWeight <= 0) {
      throw new RangeError('Grade weight must be a positive finite number')
    }

    sum += value * gradeWeight
    weight += gradeWeight
    if (!Number.isFinite(sum) || !Number.isFinite(weight)) {
      throw new RangeError('Grade average totals must be finite')
    }
  }

  return {
    sum,
    weight,
    average: weight === 0 ? null : sum / weight,
  }
}

function calculatePeriods(
  grades: readonly Grade[],
  rules: GradeRules,
  subjectRules: Pick<SchoolProfile, 'subjectRules'>,
  includeBehavior: boolean,
): GradePeriodAverages {
  return {
    year: calculateAverage(grades, rules, subjectRules, includeBehavior),
    semester1: calculateAverage(
      grades.filter((grade) => grade.semester === 1),
      rules,
      subjectRules,
      includeBehavior,
    ),
    semester2: calculateAverage(
      grades.filter((grade) => grade.semester === 2),
      rules,
      subjectRules,
      includeBehavior,
    ),
  }
}

export function calculateGradeSummary(
  grades: readonly Grade[],
  profile: Pick<SchoolProfile, 'grades' | 'subjectRules'>,
): GradeSummary {
  const gradesBySubject = new Map<string, Grade[]>()

  for (const grade of grades) {
    const subjectGrades = gradesBySubject.get(grade.subject) ?? []
    subjectGrades.push(grade)
    gradesBySubject.set(grade.subject, subjectGrades)
  }

  const overallGrades: Grade[] = []
  const separateWorkPlacementGrades: Grade[] = []
  const separatePracticalClassesGrades: Grade[] = []

  for (const grade of grades) {
    const subjectRule = profile.subjectRules.find(
      (rule) => rule.subject === grade.subject,
    )
    if (subjectRule?.includeInOverallAverage === false) {
      continue
    }

    const category = getCategory(grade, profile)
    if (category === 'work_placement') {
      if (profile.grades.workPlacementHandling === 'separate_average') {
        separateWorkPlacementGrades.push(grade)
      }
      if (profile.grades.workPlacementHandling === 'exclude_from_average') {
        continue
      }
    }
    if (category === 'practical_classes') {
      if (profile.grades.practicalClassesHandling === 'separate_average') {
        separatePracticalClassesGrades.push(grade)
      }
      if (profile.grades.practicalClassesHandling === 'exclude_from_average') {
        continue
      }
    }
    overallGrades.push(grade)
  }

  const workPlacementHandling = profile.grades.workPlacementHandling
  const practicalClassesHandling = profile.grades.practicalClassesHandling

  return {
    overall: calculatePeriods(
      overallGrades,
      profile.grades,
      profile,
      profile.grades.includeBehaviorInAverage,
    ),
    subjects: Array.from(gradesBySubject, ([subject, subjectGrades]) => ({
      subject,
      ...calculatePeriods(subjectGrades, profile.grades, profile, true),
    })),
    separate: {
      workPlacement:
        workPlacementHandling === 'separate_average'
          ? calculatePeriods(
              separateWorkPlacementGrades,
              profile.grades,
              profile,
              profile.grades.includeBehaviorInAverage,
            )
          : null,
      practicalClasses:
        practicalClassesHandling === 'separate_average'
          ? calculatePeriods(
              separatePracticalClassesGrades,
              profile.grades,
              profile,
              profile.grades.includeBehaviorInAverage,
            )
          : null,
    },
  }
}

export function calculateTargetGrade(
  current: Pick<GradeAverage, 'sum' | 'weight'>,
  targetAverage: number,
  nextGradeWeight: number,
  rules: Pick<GradeRules, 'averageMethod' | 'scale'>,
): TargetGradeResult {
  if (
    !Number.isFinite(current.sum) ||
    !Number.isFinite(current.weight) ||
    current.weight < 0 ||
    !Number.isFinite(targetAverage) ||
    !Number.isFinite(nextGradeWeight) ||
    nextGradeWeight <= 0
  ) {
    throw new RangeError('Target grade inputs must be finite and valid')
  }

  const effectiveWeight =
    rules.averageMethod === 'weighted' ? nextGradeWeight : 1
  const requiredValue =
    (targetAverage * (current.weight + effectiveWeight) - current.sum) /
    effectiveWeight
  if (!Number.isFinite(requiredValue)) {
    throw new RangeError('Required grade value must be finite')
  }

  const scaleBounds =
    rules.scale === 'one_to_six'
      ? { minimum: 1, maximum: 6 }
      : rules.scale === 'percent'
        ? { minimum: 0, maximum: 100 }
        : null

  return {
    requiredValue,
    reachable:
      scaleBounds === null
        ? null
        : requiredValue >= scaleBounds.minimum &&
          requiredValue <= scaleBounds.maximum,
  }
}
