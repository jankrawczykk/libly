import { expect, test } from 'vitest'
import {
  clearSchoolTypePreference,
  InvalidSchoolTypePreferenceError,
  readSchoolTypePreference,
  saveSchoolTypePreference,
  SCHOOL_TYPE_STORAGE_KEY,
} from '../src/features/dashboard/school-type-storage.js'

function createMemoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

test('reads, schema-validates, and clears only the school type preference', () => {
  const storage = createMemoryStorage()

  expect(readSchoolTypePreference(storage)).toBeNull()
  saveSchoolTypePreference(storage, 'technikum')
  expect(storage.getItem(SCHOOL_TYPE_STORAGE_KEY)).toBe('technikum')
  expect(readSchoolTypePreference(storage)).toBe('technikum')
  clearSchoolTypePreference(storage)
  expect(readSchoolTypePreference(storage)).toBeNull()
})

test('fails closed on an invalid persisted school type', () => {
  const storage = createMemoryStorage()
  storage.setItem(SCHOOL_TYPE_STORAGE_KEY, 'fictional_school')

  expect(() => readSchoolTypePreference(storage)).toThrow(
    InvalidSchoolTypePreferenceError,
  )
})
