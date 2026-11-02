import { expect, test } from 'vitest'
import { CORE_BOOTSTRAP_STATUS } from '../src/index.js'

test('core workspace bootstrap is available', () => {
  expect(CORE_BOOTSTRAP_STATUS).toBe('Milestone 1 pending')
})
