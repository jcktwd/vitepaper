<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useData } from 'vitepress'
import { data as posts } from '../posts.data.ts'

const { frontmatter, page } = useData()

const isSyncedDoc = computed(() => Boolean(frontmatter.value.date || frontmatter.value.outlineId))
const isDraft = computed(() => Boolean(frontmatter.value.draft))
const isUtilityNavPage = computed(
  () => Boolean(frontmatter.value.excludeFromPosts && !frontmatter.value.draft)
)

const currentPost = computed(() => {
  const currentUrl = '/' + page.value.relativePath.replace(/\.md$/, '')
  return posts.find((p) => p.url === currentUrl || p.url === currentUrl + '.html')
})

const postTransitionName = computed(() => {
  const slug = page.value.relativePath
    .replace(/^\/+/, '')
    .replace(/\.md$|\.html$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
  return `post-title-${slug}`
})

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const scrollProgress = ref(0)

function updateScroll() {
  const docEl = document.documentElement
  const scrollTop = window.scrollY || docEl.scrollTop
  const scrollHeight = docEl.scrollHeight - docEl.clientHeight
  scrollProgress.value = scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0
}

onMounted(() => {
  window.addEventListener('scroll', updateScroll, { passive: true })
  updateScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateScroll)
})
</script>

<template>
  <div v-if="isSyncedDoc" id="post-summary" class="mb-8 border-b border-dashed border-border pb-6 scroll-mt-24">
    <!-- AstroPaper Top Reading Progress Bar -->
    <div class="fixed top-0 left-0 z-50 h-1 w-full bg-transparent">
      <div
        class="h-full bg-accent transition-[width] duration-75"
        :style="{ width: `${scrollProgress}%` }"
      />
    </div>

    <!-- Unlisted Draft Preview Banner -->
    <div
      v-if="isDraft"
      class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-dashed border-accent bg-accent/10 px-3.5 py-2 text-xs font-medium text-foreground"
    >
      <div class="flex items-center gap-2">
        <span class="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Draft Preview
        </span>
        <span>Unlisted preview synced from your Outline <strong>Drafts</strong> folder.</span>
      </div>
      <a href="/drafts" class="text-accent underline decoration-dashed underline-offset-4 hover:opacity-80">
        All Drafts →
      </a>
    </div>

    <!-- Go Back Link (Shown on listed blog articles) -->
    <div v-else-if="!isUtilityNavPage" class="mb-4">
      <a
        href="/posts"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
      >
        <span aria-hidden="true">←</span>
        <span>All Posts</span>
      </a>
    </div>

    <!-- Title + Outline Icon -->
    <h1
      id="post-title"
      class="vp-post-title scroll-mt-24"
      :style="{ viewTransitionName: postTransitionName }"
    >
      <span v-if="frontmatter.icon" class="mr-2">{{ frontmatter.icon }}</span>
      <span>{{ frontmatter.title }}</span>
    </h1>

    <!-- Published / Updated / Reading Time Metadata -->
    <div
      v-if="!isUtilityNavPage"
      class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground italic"
    >
      <span class="inline-flex items-center gap-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 shrink-0 opacity-80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <time :datetime="frontmatter.date">{{ formatDate(frontmatter.date) }}</time>
      </span>

      <span
        v-if="frontmatter.updated"
        class="inline-flex items-center gap-1 rounded bg-background-soft px-2 py-0.5 text-xs not-italic border border-border"
      >
        Updated:
        <time :datetime="frontmatter.updated">{{ formatDate(frontmatter.updated) }}</time>
      </span>

      <template v-if="currentPost?.readingTime">
        <span aria-hidden="true">•</span>
        <span>{{ currentPost.readingTime }}</span>
      </template>
    </div>
  </div>
</template>
