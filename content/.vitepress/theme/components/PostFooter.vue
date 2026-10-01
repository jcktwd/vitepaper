<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'

const { frontmatter, page } = useData()

const isSyncedDoc = computed(() => Boolean(frontmatter.value.date || frontmatter.value.outlineId))
const isUtilityNavPage = computed(
  () => Boolean(frontmatter.value.excludeFromPosts && !frontmatter.value.draft)
)
const showPostFooter = computed(() => isSyncedDoc.value && !isUtilityNavPage.value)

const tags = computed<string[]>(() =>
  Array.isArray(frontmatter.value.tags) ? frontmatter.value.tags : []
)

const backlinks = computed<Array<{ title: string; link: string; icon?: string }>>(() =>
  Array.isArray(frontmatter.value.backlinks) ? frontmatter.value.backlinks : []
)

const currentUrl = ref('')

function updateCurrentUrl() {
  if (typeof window !== 'undefined') {
    currentUrl.value = window.location.href
  }
}

const shareLinks = computed(() => {
  const encodedUrl = encodeURIComponent(currentUrl.value)
  return [
    {
      name: 'whatsapp',
      title: 'Share this post on WhatsApp',
      href: `https://wa.me/?text=${encodedUrl}`,
    },
    {
      name: 'facebook',
      title: 'Share this post on Facebook',
      href: `https://www.facebook.com/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'x',
      title: 'Share this post on X',
      href: `https://x.com/intent/post?url=${encodedUrl}`,
    },
    {
      name: 'telegram',
      title: 'Share this post on Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}`,
    },
    {
      name: 'pinterest',
      title: 'Share this post on Pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}`,
    },
    {
      name: 'mail',
      title: 'Share this post via email',
      href: `mailto:?subject=See%20this%20post&body=${encodedUrl}`,
    },
  ]
})

const dockSlotRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const isDocked = ref(false)
const dockRightPx = ref<number | null>(null)
const scrollPercent = ref(0)

let ticking = false

function updateScrollAndDock() {
  if (typeof window === 'undefined') return
  const rootEl = document.documentElement
  const scrollTop = window.scrollY || rootEl.scrollTop
  const scrollTotal = rootEl.scrollHeight - rootEl.clientHeight

  const pct =
    scrollTotal > 0
      ? Math.min(100, Math.max(0, Math.floor((scrollTop / scrollTotal) * 100)))
      : 0
  scrollPercent.value = pct
  isVisible.value = scrollTotal > 0 && scrollTop / scrollTotal > 0.3

  if (dockSlotRef.value) {
    const rect = dockSlotRef.value.getBoundingClientRect()
    // Floating desktop button is h-8 (32px) at bottom-8 (32px from viewport bottom),
    // so its top edge sits at (window.innerHeight - 64).
    const floatingTopEdge = window.innerHeight - 64
    isDocked.value = rect.top <= floatingTopEdge
    dockRightPx.value = Math.max(16, rootEl.clientWidth - rect.right)
  }
}

function onScrollOrResize() {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      updateScrollAndDock()
      ticking = false
    })
    ticking = true
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(
  () => page.value.relativePath,
  async () => {
    await nextTick()
    updateCurrentUrl()
    updateScrollAndDock()
  }
)

onMounted(() => {
  updateCurrentUrl()
  updateScrollAndDock()
  window.addEventListener('scroll', onScrollOrResize, { passive: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollOrResize)
  window.removeEventListener('resize', onScrollOrResize)
})
</script>

<template>
  <div v-if="showPostFooter" class="vp-post-footer not-prose">
    <hr class="vp-post-footer-hr" />

    <!-- Back to Top Button (floats halfway down, docks on the footer when reached) -->
    <div ref="dockSlotRef" class="vp-btt-dock-slot">
      <div
        id="btt-btn-container"
        :class="[
          'vp-btt-container',
          isDocked ? ' is-docked' : 'is-floating',
          isVisible ? 'is-visible' : 'is-hidden',
        ]"
        :style="
          !isDocked && dockRightPx !== null
            ? { '--btt-dock-right': `${dockRightPx}px` }
            : undefined
        "
      >
        <button
          type="button"
          data-button="back-to-top"
          class="vp-btt-btn group"
          aria-label="Back to Top"
          @click="scrollToTop"
        >
          <!-- Circular conic-gradient progress indicator on mobile -->
          <span
            class="vp-btt-progress"
            :style="{
              backgroundImage: `conic-gradient(var(--accent), var(--accent) ${scrollPercent}%, transparent ${scrollPercent}%)`,
            }"
          />
          <!-- Mobile upward arrow (IconArrowLeft rotated 90deg) -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-btt-icon-mobile"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M5 12l14 0" />
            <path d="M5 12l6 6" />
            <path d="M5 12l6 -6" />
          </svg>
          <!-- Desktop label + IconArrowNarrowUp -->
          <span class="vp-btt-label">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="vp-btt-icon-desktop"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M12 5l0 14" />
              <path d="M16 9l-4 -4" />
              <path d="M8 9l4 -4" />
            </svg>
            <span>Back to Top</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Post Tags (AstroPaper Tag.astro style) -->
    <ul v-if="tags.length > 0" class="vp-post-footer-tags">
      <li v-for="tag in tags" :key="tag">
        <a :href="`/tags?tag=${encodeURIComponent(tag)}`" class="vp-post-tag-link">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-post-tag-hash"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M5 9l14 0" />
            <path d="M5 15l14 0" />
            <path d="M11 4l-4 16" />
            <path d="M17 4l-4 16" />
          </svg>
          <span>{{ tag }}</span>
        </a>
      </li>
    </ul>

    <!-- Share Links (AstroPaper ShareLinks.astro style) -->
    <div class="vp-share-container">
      <span class="vp-share-intro">Share this post on:</span>
      <div class="vp-share-links">
        <a
          v-for="item in shareLinks"
          :key="item.name"
          :href="item.href"
          :title="item.title"
          target="_blank"
          rel="noopener noreferrer"
          class="vp-share-btn group"
        >
          <!-- WhatsApp -->
          <svg
            v-if="item.name === 'whatsapp'"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-share-icon"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
            <path
              d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"
            />
          </svg>

          <!-- Facebook -->
          <svg
            v-else-if="item.name === 'facebook'"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-share-icon"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3" />
          </svg>

          <!-- X -->
          <svg
            v-else-if="item.name === 'x'"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-share-icon"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
            <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
          </svg>

          <!-- Telegram -->
          <svg
            v-else-if="item.name === 'telegram'"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-share-icon"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />
          </svg>

          <!-- Pinterest -->
          <svg
            v-else-if="item.name === 'pinterest'"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-share-icon"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M8 20l4 -9" />
            <path
              d="M10.7 14c.437 1.263 1.43 2 2.55 2c2.071 0 3.75 -1.554 3.75 -4a5 5 0 1 0 -9.7 1.7"
            />
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          </svg>

          <!-- Mail -->
          <svg
            v-else-if="item.name === 'mail'"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="vp-share-icon"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path
              d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z"
            />
            <path d="M3 7l9 6l9 -6" />
          </svg>

          <span class="sr-only">{{ item.title }}</span>
        </a>
      </div>
    </div>

    <!-- Referenced In (Backlinks) -->
    <aside v-if="backlinks.length > 0" class="vp-backlinks-box">
      <div class="vp-backlinks-title">Referenced In</div>
      <ul class="vp-backlinks-list">
        <li v-for="item in backlinks" :key="item.link">
          <a :href="item.link" class="vp-backlink-item">
            <span v-if="item.icon">{{ item.icon }}</span>
            <span>{{ item.title }}</span>
          </a>
        </li>
      </ul>
    </aside>
  </div>
</template>
