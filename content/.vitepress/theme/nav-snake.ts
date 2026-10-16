/**
 * The AstroPaper-style wavy underline ("snake") under the active navbar item.
 *
 * - On navigation it slides from the old item to the new one, both edges arriving together
 *   (`--snake-left` / `--snake-right` / `--snake-duration`, transitions in style.css).
 * - While hovered or travelling, its wave pattern scrolls (`--wave-phase`), easing in and coasting
 *   to a stop rather than starting/stopping abruptly.
 */

const MENU_SELECTOR = '.VPNavBarMenu'
const LINK_SELECTOR = '.VPNavBarMenu .VPNavBarMenuLink'

const WAVE_MAX_SPEED = 10 // px/s cruising speed
const WAVE_ACCEL_TAU = 0.28 // seconds time-constant to accelerate into motion
const WAVE_DECEL_TAU = 0.38 // seconds time-constant to coast to a stop
const WAVE_PERIOD = 11 // 11px SVG tile width
const WAVE_STOP_SPEED = 0.12 // px/s below which a coasting wave snaps to rest

const SNAKE_MS_PER_PX = 9
const SNAKE_MIN_DURATION_MS = 360

/** Exponential approach of `velocity` towards `target` over `dt` seconds with time-constant `tau`. */
export function easeVelocity(velocity: number, target: number, dt: number, tau: number): number {
  return velocity + (target - velocity) * (1 - Math.exp(-dt / tau))
}

/** Travel duration for a move of `distancePx`, so the snake moves at a constant speed. */
export function snakeDurationMs(distancePx: number): number {
  return Math.max(SNAKE_MIN_DURATION_MS, Math.round(distancePx * SNAKE_MS_PER_PX))
}

export interface NavSnake {
  /**
   * Moves the snake under `target` (defaults to the active nav link).
   * With `animate`, it travels there; otherwise it jumps (e.g. on resize).
   */
  update(target?: HTMLElement | null, animate?: boolean): void
}

/** Installs the nav snake's document listeners. Browser-only. */
export function installNavSnake(): NavSnake {
  let prevLeft: number | null = null
  let prevRight: number | null = null
  let travelTimer: ReturnType<typeof setTimeout> | null = null

  let wavePhase = 0
  let waveVelocity = 0
  let isHoveringNav = false
  let waveRafId: number | null = null
  let lastFrameTime = 0

  const stepWave = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000))
    lastFrameTime = now

    const wantActive = isHoveringNav || travelTimer !== null
    waveVelocity = easeVelocity(
      waveVelocity,
      wantActive ? WAVE_MAX_SPEED : 0,
      dt,
      wantActive ? WAVE_ACCEL_TAU : WAVE_DECEL_TAU
    )

    if (!wantActive && waveVelocity < WAVE_STOP_SPEED) {
      waveVelocity = 0
      waveRafId = null
      return
    }

    wavePhase = (wavePhase - waveVelocity * dt) % WAVE_PERIOD
    document
      .querySelector<HTMLElement>(`${MENU_SELECTOR} .vp-nav-snake`)
      ?.style.setProperty('--wave-phase', `${wavePhase.toFixed(2)}px`)

    waveRafId = requestAnimationFrame(stepWave)
  }

  const ensureWaveLoop = () => {
    if (waveRafId === null) {
      lastFrameTime = performance.now()
      waveRafId = requestAnimationFrame(stepWave)
    }
  }

  const getOrCreateSnake = (menu: HTMLElement): HTMLElement => {
    let snake = menu.querySelector<HTMLElement>('.vp-nav-snake')
    if (!snake) {
      snake = document.createElement('span')
      snake.className = 'vp-nav-snake'
      snake.setAttribute('aria-hidden', 'true')
      menu.appendChild(snake)
    }
    return snake
  }

  // Follow the active link on our own: VitePress re-renders the nav asynchronously after a route
  // change, so no navigation hook can reliably tell when the `active` class has moved.
  let observedMenu: HTMLElement | null = null
  let lastActiveLink: Element | null = null
  const activeLinkObserver = new MutationObserver(() => {
    const activeLink = observedMenu?.querySelector('.VPNavBarMenuLink.active') ?? null
    if (activeLink !== lastActiveLink) {
      lastActiveLink = activeLink
      update(null, true)
    }
  })
  const observeMenu = (menu: HTMLElement) => {
    if (menu === observedMenu) return
    activeLinkObserver.disconnect()
    activeLinkObserver.observe(menu, { attributes: true, attributeFilter: ['class'], subtree: true })
    observedMenu = menu
    lastActiveLink = menu.querySelector('.VPNavBarMenuLink.active')
  }

  const update = (target?: HTMLElement | null, animate = true) => {
    const menu = document.querySelector<HTMLElement>(MENU_SELECTOR)
    if (!menu) return
    observeMenu(menu)
    const snake = getOrCreateSnake(menu)

    const activeLink = target ?? menu.querySelector<HTMLElement>('.VPNavBarMenuLink.active')
    if (!activeLink) {
      snake.classList.remove('is-visible', 'is-snaking')
      prevLeft = null
      prevRight = null
      return
    }

    const menuRect = menu.getBoundingClientRect()
    if (menuRect.width === 0) return

    const textRect = (activeLink.querySelector<HTMLElement>('span') ?? activeLink).getBoundingClientRect()
    const nextLeft = Math.round(textRect.left - menuRect.left)
    const nextRight = Math.round(menuRect.right - textRect.right)

    if (animate && prevLeft !== null && prevRight !== null && snake.classList.contains('is-visible')) {
      const deltaLeft = Math.abs(nextLeft - prevLeft)
      const deltaRight = Math.abs(nextRight - prevRight)

      if (deltaLeft > 2 || deltaRight > 2) {
        const movingRight = nextLeft >= prevLeft
        // Both edges share one duration (scaled by distance) so they start and arrive together
        const durationMs = snakeDurationMs((deltaLeft + deltaRight) / 2)

        snake.style.setProperty('--snake-duration', `${durationMs}ms`)
        snake.classList.toggle('is-moving-right', movingRight)
        snake.classList.toggle('is-moving-left', !movingRight)
        snake.classList.add('is-snaking')
        ensureWaveLoop()
        if (travelTimer) clearTimeout(travelTimer)
        travelTimer = setTimeout(() => {
          snake.classList.remove('is-snaking')
          travelTimer = null
        }, durationMs + 30)
      }
    } else if (!animate && !travelTimer) {
      snake.classList.remove('is-moving-right', 'is-moving-left', 'is-snaking')
    }

    snake.style.setProperty('--snake-left', `${nextLeft}px`)
    snake.style.setProperty('--snake-right', `${nextRight}px`)
    snake.classList.add('is-visible')
    prevLeft = nextLeft
    prevRight = nextRight
  }

  // Smoothly accelerate the wave on hover, decelerate on leave
  document.addEventListener(
    'pointerover',
    (e) => {
      if ((e.target as HTMLElement | null)?.closest(LINK_SELECTOR)) {
        isHoveringNav = true
        ensureWaveLoop()
      }
    },
    { passive: true }
  )
  document.addEventListener(
    'pointerout',
    (e) => {
      if (!(e.relatedTarget as HTMLElement | null)?.closest?.(LINK_SELECTOR)) {
        isHoveringNav = false
      }
    },
    { passive: true }
  )

  // Start travelling as soon as a navbar link is clicked, before the route changes
  document.addEventListener('click', (e) => {
    const clickedNavLink = (e.target as HTMLElement | null)?.closest<HTMLElement>(LINK_SELECTOR)
    if (clickedNavLink) {
      update(clickedNavLink, true)
    }
  })

  window.addEventListener('resize', () => update(null, false), { passive: true })

  // Initialize once the navbar has rendered
  requestAnimationFrame(() => {
    setTimeout(() => update(null, false), 50)
  })

  return { update }
}
