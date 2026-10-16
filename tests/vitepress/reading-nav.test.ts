import { describe, expect, it } from 'vitest'
import { INITIAL_NAV_STATE, nextNavState, type NavInput, type NavState } from '../../content/.vitepress/theme/reading-nav.ts'

const NAV = 64
const base: NavInput = { scrollY: 0, lastScrollY: 0, navHeight: NAV, isArticle: true, canHover: true }

/** Runs a sequence of inputs (each merged over the previous one) and returns the visibility after each */
function run(steps: Array<Partial<NavInput>>, start: NavState = INITIAL_NAV_STATE): boolean[] {
  let state = start
  let input = base
  return steps.map((step) => {
    input = { ...input, lastScrollY: input.scrollY, ...step }
    state = nextNavState(state, input)
    return state.visible
  })
}

// Hovering the top of the window and keyboard focus bring the navbar back in CSS (style.css), so
// these rules only cover scrolling.
describe('nextNavState', () => {
  it('shows the navbar until scrolled past its height, and again back at the top', () => {
    expect(run([{ scrollY: 0 }, { scrollY: NAV }, { scrollY: NAV + 1 }, { scrollY: 800 }, { scrollY: 10 }])).toEqual([
      true,
      true,
      false,
      false,
      true,
    ])
  })

  it('never hides outside posts', () => {
    expect(run([{ scrollY: 800, isArticle: false }])).toEqual([true])
  })

  it('with a mouse: scrolling up does not bring it back (like AstroPaper)', () => {
    expect(run([{ scrollY: 800 }, { scrollY: 400 }, { scrollY: 200 }])).toEqual([false, false, false])
  })

  it('on touch: scrolling back up by the navbar height reveals it until the next scroll down', () => {
    expect(
      run([
        { canHover: false, scrollY: 800 },
        { scrollY: 800 - (NAV - 1) }, // a little short of the navbar height
        { scrollY: 800 - NAV }, // total upward distance reaches it
        { scrollY: 600 }, // keeps scrolling up
        { scrollY: 600 }, // no movement
        { scrollY: 610 }, // scrolls down again
        { scrollY: 590 }, // a small nudge up doesn't reveal it again
      ])
    ).toEqual([false, false, true, true, true, false, false])
  })
})
