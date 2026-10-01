import { h, nextTick } from 'vue'
import { type Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import PostHeader from './components/PostHeader.vue'
import PostFooter from './components/PostFooter.vue'
import PostList from './components/PostList.vue'
import Mermaid from './components/Mermaid.vue'
import SocialLinks from './components/SocialLinks.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => h(PostHeader),
      'doc-footer-before': () => h(PostFooter),
    })
  },
  enhanceApp({ app, router }) {
    app.component('PostList', PostList)
    app.component('Mermaid', Mermaid)
    app.component('SocialLinks', SocialLinks)

    if (typeof document !== 'undefined') {
      let prevSnakeLeft: number | null = null
      let prevSnakeRight: number | null = null
      let snakeTimer: ReturnType<typeof setTimeout> | null = null

      const updateNavSnake = (explicitTarget?: HTMLElement | null, animate = true) => {
        const menu = document.querySelector<HTMLElement>('.VPNavBarMenu')
        if (!menu) return

        let snake = menu.querySelector<HTMLElement>('.vp-nav-snake')
        if (!snake) {
          snake = document.createElement('span')
          snake.className = 'vp-nav-snake'
          snake.setAttribute('aria-hidden', 'true')
          menu.appendChild(snake)
        }

        const activeLink =
          explicitTarget ?? menu.querySelector<HTMLElement>('.VPNavBarMenuLink.active')

        if (!activeLink) {
          snake.classList.remove('is-visible', 'is-snaking')
          prevSnakeLeft = null
          prevSnakeRight = null
          return
        }

        const menuRect = menu.getBoundingClientRect()
        if (menuRect.width === 0) return

        const textSpan = activeLink.querySelector<HTMLElement>('span') ?? activeLink
        const rect = textSpan.getBoundingClientRect()
        const nextLeft = Math.round(rect.left - menuRect.left)
        const nextRight = Math.round(menuRect.right - rect.right)

        const deltaLeft = prevSnakeLeft !== null ? Math.abs(nextLeft - prevSnakeLeft) : 0
        const deltaRight = prevSnakeRight !== null ? Math.abs(nextRight - prevSnakeRight) : 0
        const avgDelta = (deltaLeft + deltaRight) / 2
        const hasMoved = prevSnakeLeft !== null && (deltaLeft > 2 || deltaRight > 2)

        if (
          animate &&
          hasMoved &&
          snake.classList.contains('is-visible') &&
          prevSnakeLeft !== null &&
          prevSnakeRight !== null
        ) {
          const movingRight = nextLeft >= prevSnakeLeft
          // Both edges share the exact same duration (scaled by distance at ~9ms/px)
          // so both start at t=0 and arrive at the exact same millisecond
          const durationMs = Math.max(360, Math.round(avgDelta * 9))

          snake.style.setProperty('--snake-duration', `${durationMs}ms`)
          snake.classList.toggle('is-moving-right', movingRight)
          snake.classList.toggle('is-moving-left', !movingRight)
          snake.classList.add('is-snaking')
          if (snakeTimer) clearTimeout(snakeTimer)
          snakeTimer = setTimeout(() => {
            snake?.classList.remove('is-snaking')
            snakeTimer = null
          }, durationMs + 30)
        } else if (!animate && !snakeTimer) {
          snake.classList.remove('is-moving-right', 'is-moving-left', 'is-snaking')
        }

        snake.style.setProperty('--snake-left', `${nextLeft}px`)
        snake.style.setProperty('--snake-right', `${nextRight}px`)
        snake.classList.add('is-visible')
        prevSnakeLeft = nextLeft
        prevSnakeRight = nextRight
      }

      // Immediately start snaking as soon as a navbar link is clicked
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null
        const clickedNavLink = target?.closest<HTMLElement>('.VPNavBarMenu .VPNavBarMenuLink')
        if (clickedNavLink) {
          updateNavSnake(clickedNavLink, true)
        }
      })

      window.addEventListener(
        'resize',
        () => {
          updateNavSnake(null, false)
        },
        { passive: true }
      )

      // Initialize once DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => updateNavSnake(null, false), 50)
      })

      router.onAfterPageLoad = async () => {
        if (
          !router.route.component ||
          !('startViewTransition' in document) ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          await nextTick()
          updateNavSnake(null, true)
          return
        }

        await new Promise<void>((resolveOldSnapshot) => {
          const transition = (
            document as Document & {
              startViewTransition: (cb: () => Promise<void>) => {
                ready?: Promise<void>
                finished?: Promise<void>
              }
            }
          ).startViewTransition(async () => {
            resolveOldSnapshot()
            await nextTick()
            await nextTick()
            await nextTick()
          })
          transition.ready?.then(() => {
            updateNavSnake(null, true)
          }).catch(() => {})
          transition.finished?.then(() => {
            updateNavSnake(null, false)
          }).catch(() => {})
        })
      }
    }
  },
} satisfies Theme
