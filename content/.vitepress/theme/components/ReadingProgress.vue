<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useData } from 'vitepress'

/**
 * AstroPaper-style reading progress across the top of the window on synced posts.
 *
 * Rendered in the layout's `layout-top` slot, outside `.VPContent`: that element's
 * `view-transition-name` makes it a stacking context below the fixed navbar, so a bar inside it
 * is painted underneath the navbar whatever its z-index.
 */
const { frontmatter } = useData()
const isSyncedDoc = computed(() => Boolean(frontmatter.value.date || frontmatter.value.outlineId))

const scrollProgress = ref(0)

function updateScroll() {
  const docEl = document.documentElement
  const scrollHeight = docEl.scrollHeight - docEl.clientHeight
  scrollProgress.value = scrollHeight > 0 ? Math.min(100, (window.scrollY / scrollHeight) * 100) : 0
}

onMounted(() => {
  window.addEventListener('scroll', updateScroll, { passive: true })
  window.addEventListener('resize', updateScroll, { passive: true })
  updateScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateScroll)
  window.removeEventListener('resize', updateScroll)
})
</script>

<template>
  <!-- pointer-events-none: it sits over the top of the window, where the pointer reveals the navbar -->
  <div v-if="isSyncedDoc" class="vp-reading-progress pointer-events-none fixed top-0 left-0 z-50 h-1 w-full bg-transparent" aria-hidden="true">
    <div class="h-full bg-accent transition-[width] duration-75" :style="{ width: `${scrollProgress}%` }" />
  </div>
</template>
