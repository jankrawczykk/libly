import { expect, test } from 'vitest'
import { SERVER_BOOTSTRAP_STATUS } from '../src/index.js'

test('server workspace bootstrap is available', () => {
  expect(SERVER_BOOTSTRAP_STATUS).toBe('Milestone 2 pending')
})
