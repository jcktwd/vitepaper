const DURATION_MS = 260
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'
/** Set while a toggle is animating closed (it stays `[open]` until the animation ends) */
const CLOSING_CLASS = 'is-closing'

/**
 * Animates toggle blocks (`<details class="custom-block">`, from Outline `+++` toggles) opening
 * and closing by tweening their height, instead of the native instant jump. Clicking again
 * mid-animation reverses smoothly from the current height. With `prefers-reduced-motion`, or
 * where the Web Animations API is missing, the native toggle is left alone. Browser-only.
 */
export function installDetailsAnimation(): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const running = new WeakMap<HTMLDetailsElement, Animation>()

  document.addEventListener('click', (event) => {
    const summary = (event.target as Element | null)?.closest('summary')
    const details = summary?.parentElement
    if (!summary || !(details instanceof HTMLDetailsElement)) return
    if (!details.matches('.vp-doc details.custom-block') || details.querySelector(':scope > summary') !== summary) return
    if (reduceMotion.matches || typeof details.animate !== 'function') return

    event.preventDefault()
    const expanding = !details.open || details.classList.contains(CLOSING_CLASS)
    const startHeight = details.getBoundingClientRect().height
    running.get(details)?.cancel()

    let endHeight: number
    if (expanding) {
      details.classList.remove(CLOSING_CLASS)
      details.open = true
      endHeight = details.getBoundingClientRect().height
    } else {
      details.classList.add(CLOSING_CLASS)
      endHeight = collapsedHeight(details, summary)
    }

    details.style.overflow = 'hidden'
    const animation = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: DURATION_MS, easing: EASING }
    )
    running.set(details, animation)
    animation.onfinish = () => {
      running.delete(details)
      details.style.overflow = ''
      if (!expanding) {
        details.open = false
        details.classList.remove(CLOSING_CLASS)
      }
    }
  })
}

/** Border-box height of `details` showing only its summary */
function collapsedHeight(details: HTMLDetailsElement, summary: HTMLElement): number {
  const style = getComputedStyle(details)
  return (
    summary.getBoundingClientRect().height +
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) +
    parseFloat(style.borderBottomWidth)
  )
}
