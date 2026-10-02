<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

type MediaType = 'image' | 'mermaid'

const isOpen = ref(false)
const mediaType = ref<MediaType>('image')
const imgSrc = ref('')
const imgAlt = ref('')
const svgContent = ref('')
const scale = ref(1)

const stageRef = ref<HTMLElement | null>(null)
const targetRef = ref<HTMLElement | null>(null)

let panzoomInstance: any = null
let pointerDownPos: { x: number; y: number; target: EventTarget | null } | null = null
let lastTapTime = 0

function prepareSvgMarkup(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  const origId = clone.getAttribute('id') || ''

  // Determine aspect ratio from viewBox or live bounding box
  const vb = clone.getAttribute('viewBox')
  let vbWidth = 800
  let vbHeight = 500

  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      vbWidth = parts[2]
      vbHeight = parts[3]
    }
  } else {
    const rect = svgEl.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      vbWidth = rect.width
      vbHeight = rect.height
      clone.setAttribute('viewBox', `0 0 ${vbWidth} ${vbHeight}`)
    }
  }

  const maxW = Math.max(280, window.innerWidth * 0.86 - 48)
  const maxH = Math.max(220, window.innerHeight * 0.76 - 48)
  const ratio = Math.min(maxW / vbWidth, maxH / vbHeight)

  const fittedW = Math.round(vbWidth * ratio)
  const fittedH = Math.round(vbHeight * ratio)

  clone.setAttribute('width', `${fittedW}`)
  clone.setAttribute('height', `${fittedH}`)
  clone.setAttribute(
    'style',
    `width: ${fittedW}px !important; height: ${fittedH}px !important; max-width: none !important; max-height: none !important; display: block;`
  )

  let html = clone.outerHTML
  if (origId) {
    const zoomId = `${origId}-zoom`
    html = html.replaceAll(origId, zoomId)
  }

  return html
}

async function initPanzoom() {
  await nextTick()
  const target = targetRef.value
  const stage = stageRef.value
  if (!target || !stage) return

  if (panzoomInstance) {
    panzoomInstance.destroy()
    panzoomInstance = null
  }

  const Panzoom = (await import('@panzoom/panzoom')).default
  panzoomInstance = Panzoom(target, {
    maxScale: 8,
    minScale: 0.5,
    step: 0.35,
    canvas: true,
    animate: false,
  })

  scale.value = 1

  target.addEventListener('panzoomchange', ((e: CustomEvent) => {
    if (e.detail && typeof e.detail.scale === 'number') {
      scale.value = e.detail.scale
    }
  }) as EventListener)
}

let hasPushedState = false
let ignoringNextPopState = false

function pushLightboxState() {
  if (hasPushedState || typeof window === 'undefined') return
  window.history.pushState({ ...(window.history.state || {}), vpLightbox: true }, '')
  hasPushedState = true
}

function openImage(src: string, alt: string) {
  mediaType.value = 'image'
  imgSrc.value = src
  imgAlt.value = alt
  svgContent.value = ''
  isOpen.value = true
  document.body.style.overflow = 'hidden'
  pushLightboxState()
  void initPanzoom()
}

function openMermaid(svgEl: SVGSVGElement, title = 'Diagram') {
  mediaType.value = 'mermaid'
  svgContent.value = prepareSvgMarkup(svgEl)
  imgSrc.value = ''
  imgAlt.value = title
  isOpen.value = true
  document.body.style.overflow = 'hidden'
  pushLightboxState()
  void initPanzoom()
}

function onOpenMermaidEvent(e: Event) {
  const customEvent = e as CustomEvent<SVGSVGElement>
  if (customEvent.detail) {
    openMermaid(customEvent.detail)
  }
}

function closeInternal() {
  if (!isOpen.value) return
  isOpen.value = false
  document.body.style.overflow = ''
  if (panzoomInstance) {
    panzoomInstance.destroy()
    panzoomInstance = null
  }
}

function close() {
  if (!isOpen.value) return
  closeInternal()
  if (hasPushedState && typeof window !== 'undefined') {
    hasPushedState = false
    ignoringNextPopState = true
    window.history.back()
  }
}

function onPopState(e: PopStateEvent) {
  if (ignoringNextPopState) {
    ignoringNextPopState = false
    e.stopImmediatePropagation()
    return
  }
  if (isOpen.value) {
    hasPushedState = false
    e.stopImmediatePropagation()
    closeInternal()
  }
}

function zoomIn() {
  panzoomInstance?.zoomIn({ animate: true })
}

function zoomOut() {
  panzoomInstance?.zoomOut({ animate: true })
}

function resetZoom() {
  panzoomInstance?.reset({ animate: true })
}

function onWheel(e: WheelEvent) {
  if (!panzoomInstance) return
  panzoomInstance.zoomWithWheel(e)
}

function onStagePointerDown(e: PointerEvent) {
  pointerDownPos = { x: e.clientX, y: e.clientY, target: e.target }
}

function onStagePointerUp(e: PointerEvent) {
  if (!pointerDownPos) return
  const dx = e.clientX - pointerDownPos.x
  const dy = e.clientY - pointerDownPos.y
  const dist = Math.hypot(dx, dy)
  const downTarget = pointerDownPos.target as Element | null
  pointerDownPos = null

  if (dist > 6) return

  // Double-tap / double-click on the media toggles 1x <-> 2.5x zoom
  const now = performance.now()
  const isInsideMedia = downTarget?.closest?.('.vp-lightbox-target')
  if (isInsideMedia && now - lastTapTime < 300) {
    lastTapTime = 0
    if (scale.value > 1.35) {
      panzoomInstance?.reset({ animate: true })
    } else {
      panzoomInstance?.zoomToPoint(2.5, { clientX: e.clientX, clientY: e.clientY }, { animate: true })
    }
    return
  }
  lastTapTime = now

  // Single tap/click directly on the empty stage background closes the lightbox
  if (downTarget === stageRef.value) {
    close()
  }
}

function onDocumentClick(e: MouseEvent) {
  if (isOpen.value) return
  const rawTarget = e.target
  const target =
    rawTarget instanceof Element
      ? rawTarget
      : rawTarget instanceof Node
        ? rawTarget.parentElement
        : null
  if (!target) return

  // Check if user clicked an article image
  const imgEl = target.closest<HTMLImageElement>(
    '.vp-doc img:not(.vp-inline-icon-img):not(.nolebase-enhanced-img)'
  )
  if (imgEl && (imgEl.dataset.src || imgEl.src)) {
    const parentLink = imgEl.closest('a')
    if (parentLink && parentLink.getAttribute('href')) return
    e.preventDefault()
    openImage(imgEl.dataset.src || imgEl.currentSrc || imgEl.src, imgEl.alt || '')
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault()
    zoomIn()
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    zoomOut()
  } else if (e.key === '0') {
    e.preventDefault()
    resetZoom()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('vp:open-mermaid', onOpenMermaidEvent)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('popstate', onPopState, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('vp:open-mermaid', onOpenMermaidEvent)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('popstate', onPopState, true)
  if (panzoomInstance) {
    panzoomInstance.destroy()
    panzoomInstance = null
  }
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="vp-lightbox-fade">
      <div
        v-if="isOpen"
        class="vp-lightbox-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Fullscreen media viewer"
      >
        <!-- Interactive Pan/Zoom Stage -->
        <div
          ref="stageRef"
          class="vp-lightbox-stage"
          @wheel.prevent="onWheel"
          @pointerdown.capture="onStagePointerDown"
          @pointerup.capture="onStagePointerUp"
        >
          <div
            ref="targetRef"
            class="vp-lightbox-target"
            :class="{ 'is-mermaid': mediaType === 'mermaid' }"
          >
            <img
              v-if="mediaType === 'image'"
              :src="imgSrc"
              :alt="imgAlt"
              class="vp-lightbox-img"
              draggable="false"
            />
            <div
              v-else
              class="vp-lightbox-svg-wrap"
              v-html="svgContent"
            />
          </div>
        </div>

        <!-- Optional Caption for Images -->
        <div v-if="imgAlt && mediaType === 'image'" class="vp-lightbox-caption">
          {{ imgAlt }}
        </div>

        <!-- AstroPaper Floating HUD Controls -->
        <div class="vp-lightbox-hud" @click.stop>
          <button
            type="button"
            class="vp-lightbox-btn"
            title="Zoom out (-)"
            aria-label="Zoom out"
            @click="zoomOut"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <button
            type="button"
            class="vp-lightbox-btn vp-lightbox-scale"
            title="Reset zoom (0)"
            aria-label="Reset zoom"
            @click="resetZoom"
          >
            {{ Math.round(scale * 100) }}%
          </button>

          <button
            type="button"
            class="vp-lightbox-btn"
            title="Zoom in (+)"
            aria-label="Zoom in"
            @click="zoomIn"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <span class="vp-lightbox-divider" aria-hidden="true" />

          <button
            type="button"
            class="vp-lightbox-btn vp-lightbox-close"
            title="Close (Esc)"
            aria-label="Close fullscreen viewer"
            @click="close"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
