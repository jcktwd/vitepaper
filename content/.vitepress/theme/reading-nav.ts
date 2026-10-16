import type { Router } from 'vitepress'

/**
 * Reading mode on post pages: the navbar gets out of the way once you start reading, leaving the
 * reading progress bar (ReadingProgress.vue) alone across the top, as on AstroPaper.
 *
 * This decides when the navbar is hidden (the `vp-nav-hidden` class); everything else is CSS in
 * style.css: the slide, bringing it back while the pointer is at the top of the window or over it,
 * and keeping it while focus is inside it.
 *
 * - It hides once you scroll past it, and comes back at the top of the page.
 * - With a mouse, scrolling up doesn't bring it back (as on AstroPaper); the top edge does.
 * - Without one (touch), scrolling back up by the navbar's height brings it back instead.
 *
 * All distances are in units of the navbar's height. Browser-only.
 */

const POST_PATH_RE = /^\/posts\/[^/]+/

export interface NavState {
  visible: boolean
  /** Upward scroll accumulated since the last downward scroll */
  upScroll: number
}

export interface NavInput {
  scrollY: number
  lastScrollY: number
  navHeight: number
  isArticle: boolean
  /** A mouse or trackpad is the primary input (otherwise touch rules apply) */
  canHover: boolean
}

export const INITIAL_NAV_STATE: NavState = { visible: true, upScroll: 0 }

export function nextNavState(prev: NavState, input: NavInput): NavState {
  const { scrollY, lastScrollY, navHeight, isArticle, canHover } = input
  if (!isArticle || scrollY <= navHeight) return INITIAL_NAV_STATE
  if (canHover) return { visible: false, upScroll: 0 }

  const delta = scrollY - lastScrollY
  const upScroll = delta < 0 ? prev.upScroll - delta : delta > 0 ? 0 : prev.upScroll
  const visible = delta > 0 ? false : prev.visible || upScroll >= navHeight
  return { visible, upScroll }
}

export function installReadingNav(router: Router): void {
  const canHoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  let state = INITIAL_NAV_STATE
  let lastScrollY = window.scrollY
  let rafId: number | null = null

  const update = () => {
    rafId = null
    const scrollY = window.scrollY
    state = nextNavState(state, {
      scrollY,
      lastScrollY,
      navHeight: document.querySelector<HTMLElement>('.VPNav')?.offsetHeight || 64,
      isArticle: POST_PATH_RE.test(location.pathname) && document.querySelector('.VPDoc') !== null,
      canHover: canHoverQuery.matches,
    })
    lastScrollY = scrollY
    document.documentElement.classList.toggle('vp-nav-hidden', !state.visible)
  }

  const schedule = () => {
    rafId ??= requestAnimationFrame(update)
  }

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })

  const previousAfterRouteChange = router.onAfterRouteChange
  router.onAfterRouteChange = async (href) => {
    await previousAfterRouteChange?.(href)
    state = INITIAL_NAV_STATE
    schedule()
  }

  schedule()
}
