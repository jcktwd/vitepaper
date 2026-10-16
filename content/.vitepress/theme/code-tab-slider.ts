import { snakeDurationMs } from './nav-snake.ts'

/** Same edge easings as the navbar snake (style.css): the leading edge pulls ahead, the trailing edge follows */
const LEADING_EDGE_EASING = 'cubic-bezier(0.25, 0.55, 0.35, 1)'
const TRAILING_EDGE_EASING = 'cubic-bezier(0.45, 0.15, 0.6, 1)'
/** Travels this many times faster than the navbar snake */
const SPEED_FACTOR = 2
/**
 * Tab bars span far more than the navbar, so even at double speed a jump across several tabs
 * would drag on; longer moves are capped at this duration instead
 */
const MAX_DURATION_MS = 400
/** Inset of VitePress's active-tab underline (`label::after { left: 8px; right: 8px }`) */
const UNDERLINE_INSET_PX = 8
const SLIDING_CLASS = 'is-tab-sliding'

interface Slide {
  bar: HTMLElement
  animations: Animation[]
}

/**
 * Slides the active-tab underline of code groups across to the newly picked tab with the navbar snake's
 * stretch, at twice its speed (capped for long jumps) and without the wave. VitePress's own static
 * underline (`label::after`) is hidden only while a temporary bar travels, so nothing needs re-measuring
 * on load, resize or navigation. Skipped with `prefers-reduced-motion`. Browser-only.
 */
export function installCodeTabSlider(): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const previousLabel = new WeakMap<HTMLElement, HTMLLabelElement | null>()
  const slides = new WeakMap<HTMLElement, Slide>()

  // Remember the active tab just before a pointer or keyboard interaction can change it
  const rememberActive = (event: Event) => {
    const tabs = (event.target as Element | null)?.closest?.<HTMLElement>('.vp-code-group .tabs')
    if (tabs) previousLabel.set(tabs, tabs.querySelector<HTMLLabelElement>('input:checked + label'))
  }
  document.addEventListener('pointerdown', rememberActive, true)
  document.addEventListener('keydown', rememberActive, true)

  document.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement | null
    const tabs = input?.closest<HTMLElement>('.vp-code-group .tabs')
    if (!input || !tabs || reduceMotion.matches) return

    const from = previousLabel.get(tabs)
    const to = input.nextElementSibling
    previousLabel.set(tabs, to instanceof HTMLLabelElement ? to : null)
    if (!from || !(to instanceof HTMLLabelElement) || from === to) return

    slide(tabs, from, to)
  })

  function slide(tabs: HTMLElement, from: HTMLLabelElement, to: HTMLLabelElement) {
    const target = underlineEdges(tabs, to)
    // Continue from wherever an interrupted slide had got to
    const running = slides.get(tabs)
    const start = running ? currentEdges(running.bar) : underlineEdges(tabs, from)
    running?.animations.forEach((a) => a.cancel())

    const bar = running?.bar ?? tabs.appendChild(Object.assign(document.createElement('span'), { className: 'vp-tab-slider' }))
    bar.setAttribute('aria-hidden', 'true')
    bar.style.top = `${to.offsetTop + to.offsetHeight - 2}px`
    bar.style.left = `${target.left}px`
    bar.style.right = `${target.right}px`
    tabs.classList.add(SLIDING_CLASS)

    const movingRight = target.left >= start.left
    const distancePx = (Math.abs(target.left - start.left) + Math.abs(target.right - start.right)) / 2
    const durationMs = Math.min(MAX_DURATION_MS, snakeDurationMs(distancePx) / SPEED_FACTOR)
    const edge = (prop: 'left' | 'right', from: number, to: number, leading: boolean) =>
      bar.animate({ [prop]: [`${from}px`, `${to}px`] }, { duration: durationMs, easing: leading ? LEADING_EDGE_EASING : TRAILING_EDGE_EASING })
    const animations = [
      edge('left', start.left, target.left, !movingRight),
      edge('right', start.right, target.right, movingRight),
    ]
    slides.set(tabs, { bar, animations })

    Promise.all(animations.map((a) => a.finished))
      .then(() => {
        bar.remove()
        slides.delete(tabs)
        tabs.classList.remove(SLIDING_CLASS)
      })
      .catch(() => {
        // Cancelled by a newer slide, which takes over the bar
      })
  }
}

/**
 * Underline edges for `label`, as the bar's `left` / `right` within the tab bar. Both are measured from
 * the bar's unscrolled padding box (so `right` goes negative for tabs scrolled out of view to the right).
 */
function underlineEdges(tabs: HTMLElement, label: HTMLElement): { left: number; right: number } {
  // Bounding rects rather than offsetLeft/offsetWidth: those round to whole pixels, which would leave
  // the bar a fraction of a pixel off the static underline it hands over to
  const tabsRect = tabs.getBoundingClientRect()
  const labelRect = label.getBoundingClientRect()
  const style = getComputedStyle(tabs)
  const paddingLeft = tabsRect.left + parseFloat(style.borderLeftWidth) - tabs.scrollLeft
  const paddingWidth = tabsRect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
  return {
    left: labelRect.left - paddingLeft + UNDERLINE_INSET_PX,
    right: paddingWidth - (labelRect.right - paddingLeft) + UNDERLINE_INSET_PX,
  }
}

function currentEdges(bar: HTMLElement): { left: number; right: number } {
  const style = getComputedStyle(bar)
  return { left: parseFloat(style.left), right: parseFloat(style.right) }
}
