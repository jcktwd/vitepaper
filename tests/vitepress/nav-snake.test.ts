import { describe, expect, it } from 'vitest'
import { easeVelocity, snakeDurationMs } from '../../content/.vitepress/theme/nav-snake.ts'

describe('easeVelocity', () => {
  it('moves ~63% of the way to the target after one time-constant', () => {
    expect(easeVelocity(0, 10, 0.28, 0.28)).toBeCloseTo(10 * (1 - Math.exp(-1)), 6)
  })

  it('never overshoots and is a no-op at the target or with dt = 0', () => {
    expect(easeVelocity(0, 10, 100, 0.28)).toBeLessThanOrEqual(10)
    expect(easeVelocity(10, 10, 0.016, 0.28)).toBe(10)
    expect(easeVelocity(4, 10, 0, 0.28)).toBe(4)
  })
})

describe('snakeDurationMs', () => {
  it('scales with distance at 9ms/px with a 360ms floor', () => {
    expect(snakeDurationMs(10)).toBe(360)
    expect(snakeDurationMs(100)).toBe(900)
    expect(snakeDurationMs(100.4)).toBe(904)
  })
})
