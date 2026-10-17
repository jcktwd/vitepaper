import { describe, expect, it } from 'vitest'
import { formatPostDate } from '../../content/.vitepress/theme/format-date.ts'

describe('formatPostDate', () => {
  it('shows the day in the site timezone, not the machine one', () => {
    // 23:30 UTC on 31 Aug is already 1 Sep in London (BST)
    const lateEvening = '2026-08-31T23:30:00.000Z'
    expect(formatPostDate(lateEvening, 'UTC')).toBe('31 Aug 2026')
    expect(formatPostDate(lateEvening, 'Europe/London')).toBe('1 Sept 2026')
  })

  it('returns nothing for a missing or unreadable date', () => {
    expect(formatPostDate(undefined, 'UTC')).toBe('')
    expect(formatPostDate('not a date', 'UTC')).toBe('')
  })
})
