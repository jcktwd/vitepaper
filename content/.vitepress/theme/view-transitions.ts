import { nextTick } from 'vue'
import type { Router } from 'vitepress'

interface ViewTransition {
  ready?: Promise<void>
  finished?: Promise<void>
}

type DocumentWithViewTransitions = Document & {
  startViewTransition: (update: () => Promise<void>) => ViewTransition
}

export interface PageTransitionHooks {
  /** A transition's animation is starting (the new page has rendered) */
  onReady(): void
  /** A transition's animation has finished */
  onFinished(): void
}

/**
 * Cross-fades client-side page navigations with the View Transitions API (skipped when unsupported
 * or with `prefers-reduced-motion`).
 *
 * Browsers that already animate a navigation themselves (e.g. a mobile back-swipe) flag it with
 * `hasUAVisualTransition`; those are skipped so the page doesn't animate twice. Browser-only.
 */
export function installPageViewTransitions(router: Router, hooks: PageTransitionHooks): void {
  let skipNextViewTransition = false

  const markUAVisualTransition = (e: Event) => {
    if ((e as Event & { hasUAVisualTransition?: boolean }).hasUAVisualTransition) {
      skipNextViewTransition = true
      setTimeout(() => {
        skipNextViewTransition = false
      }, 600)
    }
  }

  window.addEventListener('popstate', markUAVisualTransition, { capture: true })
  ;(window as Window & { navigation?: EventTarget }).navigation?.addEventListener(
    'navigate',
    markUAVisualTransition,
    { capture: true }
  )

  // Despite its name, VitePress awaits `onAfterPageLoad` *before* assigning the new route, so the new
  // page only renders once this hook has returned (or, below, once the old page is snapshotted).
  router.onAfterPageLoad = async () => {
    if (
      skipNextViewTransition ||
      !router.route.component ||
      !('startViewTransition' in document) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      skipNextViewTransition = false
      return
    }

    // The update callback only runs once the browser has snapshotted the old page, so resolving there
    // lets VitePress continue; the callback then waits for the new DOM to render.
    await new Promise<void>((resolveOldSnapshot) => {
      const transition = (document as DocumentWithViewTransitions).startViewTransition(async () => {
        resolveOldSnapshot()
        await nextTick()
        await nextTick()
        await nextTick()
      })
      transition.ready?.then(hooks.onReady).catch(() => {})
      transition.finished?.then(hooks.onFinished).catch(() => {})
    })
  }
}
