import { describe, expect, test } from 'vitest'
import {
  getSchoolProfilePreset,
  SCHOOL_TYPES,
  SchoolProfilePresetSchema,
} from '../src/index.js'

describe('school profile presets', () => {
  test('provides a valid, editable, labeled preset for every school type', () => {
    const presets = SCHOOL_TYPES.map((schoolType) =>
      getSchoolProfilePreset(schoolType),
    )

    expect(presets).toHaveLength(SCHOOL_TYPES.length)

    for (const [index, preset] of presets.entries()) {
      expect(SchoolProfilePresetSchema.parse(preset)).toEqual(preset)
      expect(preset.label).toBe('Typowe wartości, sprawdź statut swojej szkoły')
      expect(preset.profile.schoolType).toBe(SCHOOL_TYPES[index])
      expect(preset.profile.subjectRules).toEqual([])
      expect(preset.profile.attendance.symbolMap).toEqual({})
      expect(preset.profile.terms.terms).toEqual([])
    }
  })

  test('technikum and branżowa presets offer separate practical and placement averages', () => {
    for (const schoolType of SCHOOL_TYPES) {
      const { grades } = getSchoolProfilePreset(schoolType).profile
      const typicalVocationalSetting =
        schoolType === 'technikum' ||
        schoolType === 'vocational_stage1' ||
        schoolType === 'vocational_stage2'

      expect(grades.workPlacementHandling).toBe(
        typicalVocationalSetting ? 'separate_average' : 'exclude_from_average',
      )
      expect(grades.practicalClassesHandling).toBe(
        typicalVocationalSetting ? 'separate_average' : 'exclude_from_average',
      )
    }
  })

  test('returns editable profiles without sharing mutations between loads', () => {
    const first = getSchoolProfilePreset('general_lyceum')
    const second = getSchoolProfilePreset('general_lyceum')

    first.profile.attendance.criticalThreshold = 25

    expect(second.profile.attendance.criticalThreshold).toBe(50)
    expect(
      getSchoolProfilePreset('general_lyceum').profile.attendance
        .criticalThreshold,
    ).toBe(50)
  })
})
