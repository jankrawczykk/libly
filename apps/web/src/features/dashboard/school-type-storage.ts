import {
  getSchoolProfilePreset,
  migrateSchoolProfile,
  SchoolTypeSchema,
  type SchoolProfile,
  UnsupportedSchoolProfileVersionError,
} from '@libly/core'
import { ZodError, z } from 'zod'

export const SCHOOL_PROFILE_QUERY_KEY = ['school-profile'] as const
export const SCHOOL_PROFILE_STORAGE_KEY = 'libly.school-profile.v1'
export const SCHOOL_TYPE_STORAGE_KEY = 'libly.school-type.v1'

const StoredSchoolTypeSchema = z.string().pipe(SchoolTypeSchema)

export class InvalidSchoolProfilePreferenceError extends Error {
  constructor() {
    super('Stored school profile is invalid.')
    this.name = 'InvalidSchoolProfilePreferenceError'
  }
}

export function readSchoolProfilePreference(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): SchoolProfile | null {
  const storedProfile = storage.getItem(SCHOOL_PROFILE_STORAGE_KEY)
  if (storedProfile !== null) {
    let parsedProfile: unknown
    try {
      parsedProfile = JSON.parse(storedProfile)
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InvalidSchoolProfilePreferenceError()
      }
      throw error
    }

    try {
      return migrateSchoolProfile(parsedProfile)
    } catch (error) {
      if (
        error instanceof ZodError ||
        error instanceof UnsupportedSchoolProfileVersionError
      ) {
        throw new InvalidSchoolProfilePreferenceError()
      }
      throw error
    }
  }

  const legacySchoolType = storage.getItem(SCHOOL_TYPE_STORAGE_KEY)
  if (legacySchoolType === null) {
    return null
  }

  const result = StoredSchoolTypeSchema.safeParse(legacySchoolType)
  if (!result.success) {
    throw new InvalidSchoolProfilePreferenceError()
  }

  const profile = getSchoolProfilePreset(result.data).profile
  saveSchoolProfilePreference(storage, profile)
  storage.removeItem(SCHOOL_TYPE_STORAGE_KEY)
  return profile
}

export function saveSchoolProfilePreference(
  storage: Pick<Storage, 'setItem'>,
  profile: SchoolProfile,
): void {
  const validatedProfile = migrateSchoolProfile(profile)
  storage.setItem(SCHOOL_PROFILE_STORAGE_KEY, JSON.stringify(validatedProfile))
}

export function clearSchoolProfilePreference(
  storage: Pick<Storage, 'removeItem'>,
): void {
  storage.removeItem(SCHOOL_PROFILE_STORAGE_KEY)
  storage.removeItem(SCHOOL_TYPE_STORAGE_KEY)
}
