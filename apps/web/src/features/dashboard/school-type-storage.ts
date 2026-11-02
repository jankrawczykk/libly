import { SchoolTypeSchema, type SchoolType } from '@libly/core'
import { z } from 'zod'

export const SCHOOL_TYPE_QUERY_KEY = ['school-type'] as const
export const SCHOOL_TYPE_STORAGE_KEY = 'libly.school-type.v1'

const StoredSchoolTypeSchema = z.string().pipe(SchoolTypeSchema)

export class InvalidSchoolTypePreferenceError extends Error {
  constructor() {
    super('Stored school type is invalid.')
    this.name = 'InvalidSchoolTypePreferenceError'
  }
}

export function readSchoolTypePreference(
  storage: Pick<Storage, 'getItem'>,
): SchoolType | null {
  const storedValue = storage.getItem(SCHOOL_TYPE_STORAGE_KEY)
  if (storedValue === null) {
    return null
  }

  const result = StoredSchoolTypeSchema.safeParse(storedValue)
  if (!result.success) {
    throw new InvalidSchoolTypePreferenceError()
  }

  return result.data
}

export function saveSchoolTypePreference(
  storage: Pick<Storage, 'setItem'>,
  schoolType: SchoolType,
): void {
  const validatedSchoolType = SchoolTypeSchema.parse(schoolType)
  storage.setItem(SCHOOL_TYPE_STORAGE_KEY, validatedSchoolType)
}

export function clearSchoolTypePreference(
  storage: Pick<Storage, 'removeItem'>,
): void {
  storage.removeItem(SCHOOL_TYPE_STORAGE_KEY)
}
