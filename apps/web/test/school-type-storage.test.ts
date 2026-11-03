import { getSchoolProfilePreset } from '@libly/core'
import { expect, test } from 'vitest'
import {
  clearSchoolProfilePreference,
  InvalidSchoolProfilePreferenceError,
  readSchoolProfilePreference,
  saveSchoolProfilePreference,
  SCHOOL_PROFILE_STORAGE_KEY,
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

test('stores, validates, and clears the complete school profile', () => {
  const storage = createMemoryStorage()
  const profile = getSchoolProfilePreset('technikum').profile

  expect(readSchoolProfilePreference(storage)).toBeNull()
  saveSchoolProfilePreference(storage, profile)
  expect(storage.getItem(SCHOOL_PROFILE_STORAGE_KEY)).toBe(
    JSON.stringify(profile),
  )
  expect(readSchoolProfilePreference(storage)).toEqual(profile)
  clearSchoolProfilePreference(storage)
  expect(readSchoolProfilePreference(storage)).toBeNull()
})

test('migrates the stored school type to its validated preset profile', () => {
  const storage = createMemoryStorage()
  storage.setItem(SCHOOL_TYPE_STORAGE_KEY, 'technikum')

  expect(readSchoolProfilePreference(storage)).toEqual(
    getSchoolProfilePreset('technikum').profile,
  )
  expect(storage.getItem(SCHOOL_TYPE_STORAGE_KEY)).toBeNull()
  expect(storage.getItem(SCHOOL_PROFILE_STORAGE_KEY)).not.toBeNull()
})

test('rejects invalid and unsupported stored profiles', () => {
  const storage = createMemoryStorage()
  storage.setItem(SCHOOL_PROFILE_STORAGE_KEY, '{not json')
  expect(() => readSchoolProfilePreference(storage)).toThrow(
    InvalidSchoolProfilePreferenceError,
  )

  storage.setItem(SCHOOL_PROFILE_STORAGE_KEY, JSON.stringify({ version: 99 }))
  expect(() => readSchoolProfilePreference(storage)).toThrow(
    InvalidSchoolProfilePreferenceError,
  )
})

test('rejects invalid legacy school types', () => {
  const storage = createMemoryStorage()
  storage.setItem(SCHOOL_TYPE_STORAGE_KEY, 'fictional_school')

  expect(() => readSchoolProfilePreference(storage)).toThrow(
    InvalidSchoolProfilePreferenceError,
  )
})
