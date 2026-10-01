<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { data as posts, type PostItem } from '../posts.data.ts'

const props = withDefaults(
  defineProps<{
    mode?: 'home' | 'all' | 'tags'
    limit?: number
  }>(),
  {
    mode: 'home',
    limit: 5,
  }
)

const { site, theme } = useData()

const pageLimit = computed(() => theme.value.postsPerPage || props.limit)
const selectedTag = ref<string>('')

onMounted(() => {
  if (props.mode === 'tags') {
    const params = new URLSearchParams(window.location.search)
    selectedTag.value = params.get('tag') || ''
  }
})

function selectTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? '' : tag
  const url = new URL(window.location.href)
  if (selectedTag.value) {
    url.searchParams.set('tag', selectedTag.value)
  } else {
    url.searchParams.delete('tag')
  }
  window.history.replaceState({}, '', url.toString())
}

const featuredPosts = computed(() => posts.filter((p) => p.featured))
const recentPosts = computed(() => {
  const nonFeatured = posts.filter((p) => !p.featured)
  const list = featuredPosts.value.length > 0 ? nonFeatured : posts
  return list.slice(0, pageLimit.value)
})

const allTags = computed(() => {
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})

const filteredByTag = computed<PostItem[]>(() => {
  if (!selectedTag.value) return posts
  return posts.filter((p) => p.tags.includes(selectedTag.value))
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="not-prose my-4">
    <!-- Configurable Homepage Hero (driven by vitepaper.config.ts) -->
    <div
      v-if="mode === 'home'"
      class="border-b border-dashed border-border pb-6 mb-8"
    >
      <div class="flex items-center gap-3 mb-3">
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {{ site.title }}
        </h1>
        <a
          href="/rss.xml"
          target="_blank"
          aria-label="RSS Feed"
          title="RSS Feed"
          class="text-accent hover:opacity-80 inline-flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 11a9 9 0 0 1 9 9" />
            <path d="M4 4a16 16 0 0 1 16 16" />
            <circle cx="5" cy="19" r="1" />
          </svg>
        </a>
      </div>
      <p
        v-if="theme.intro || site.description"
        class="text-sm sm:text-base text-foreground/90 leading-relaxed"
      >
        {{ theme.intro || site.description }}
      </p>
    </div>

    <!-- Empty State -->
    <div
      v-if="posts.length === 0"
      class="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground"
    >
      No posts synced yet. Run <code class="text-accent font-semibold">pnpm sync:drafts</code> or
      <code class="text-accent font-semibold">pnpm sync</code> to pull articles from Outline.
    </div>

    <!-- MODE: HOME (Featured + Recent) -->
    <template v-else-if="mode === 'home'">
      <section v-if="featuredPosts.length > 0" class="pb-6 border-b border-dashed border-border mb-6">
        <h2 class="text-xl font-bold tracking-wide uppercase text-foreground mb-4">Featured</h2>
        <ul class="space-y-6">
          <li v-for="post in featuredPosts" :key="post.url" class="group">
            <a :href="post.url" class="inline-block">
              <h3
                class="text-lg font-semibold text-accent decoration-dashed underline-offset-4 group-hover:underline"
              >
                <span v-if="post.icon" class="mr-1.5">{{ post.icon }}</span>
                <span>{{ post.title }}</span>
              </h3>
            </a>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground italic">
              <time :datetime="post.date">{{ formatDate(post.date) }}</time>
              <span v-if="post.updated" class="not-italic">(Updated {{ formatDate(post.updated) }})</span>
              <span>•</span>
              <span>{{ post.readingTime }}</span>
            </div>
            <p v-if="post.description" class="mt-2 text-sm text-foreground/90 leading-relaxed">
              {{ post.description }}
            </p>
            <div v-if="post.tags.length > 0" class="mt-2 flex flex-wrap gap-2">
              <a
                v-for="tag in post.tags"
                :key="tag"
                :href="`/tags?tag=${encodeURIComponent(tag)}`"
                class="text-xs text-muted-foreground hover:text-accent underline decoration-dashed underline-offset-4"
              >
                #{{ tag }}
              </a>
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-bold tracking-wide uppercase text-foreground mb-4">Recent Posts</h2>
        <ul class="space-y-6">
          <li v-for="post in recentPosts" :key="post.url" class="group">
            <a :href="post.url" class="inline-block">
              <h3
                class="text-lg font-semibold text-accent decoration-dashed underline-offset-4 group-hover:underline"
              >
                <span v-if="post.icon" class="mr-1.5">{{ post.icon }}</span>
                <span>{{ post.title }}</span>
              </h3>
            </a>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground italic">
              <time :datetime="post.date">{{ formatDate(post.date) }}</time>
              <span v-if="post.updated" class="not-italic">(Updated {{ formatDate(post.updated) }})</span>
              <span>•</span>
              <span>{{ post.readingTime }}</span>
            </div>
            <p v-if="post.description" class="mt-2 text-sm text-foreground/90 leading-relaxed">
              {{ post.description }}
            </p>
            <div v-if="post.tags.length > 0" class="mt-2 flex flex-wrap gap-2">
              <a
                v-for="tag in post.tags"
                :key="tag"
                :href="`/tags?tag=${encodeURIComponent(tag)}`"
                class="text-xs text-muted-foreground hover:text-accent underline decoration-dashed underline-offset-4"
              >
                #{{ tag }}
              </a>
            </div>
          </li>
        </ul>

        <div class="mt-8 text-center sm:text-left">
          <a
            href="/posts"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-accent underline decoration-dashed underline-offset-4"
          >
            <span>All Posts</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </template>

    <!-- MODE: ALL POSTS -->
    <template v-else-if="mode === 'all'">
      <p class="text-sm text-muted-foreground italic mb-6">
        All the articles I've posted ({{ posts.length }}).
      </p>
      <ul class="space-y-7">
        <li
          v-for="post in posts"
          :key="post.url"
          class="group border-b border-dashed border-border/60 pb-6 last:border-none"
        >
          <a :href="post.url" class="inline-block">
            <h2
              class="text-lg sm:text-xl font-semibold text-accent decoration-dashed underline-offset-4 group-hover:underline"
            >
              <span v-if="post.icon" class="mr-1.5">{{ post.icon }}</span>
              <span>{{ post.title }}</span>
            </h2>
          </a>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground italic">
            <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            <span v-if="post.updated" class="not-italic">(Updated {{ formatDate(post.updated) }})</span>
            <span>•</span>
            <span>{{ post.readingTime }}</span>
          </div>
          <p v-if="post.description" class="mt-2 text-sm text-foreground/90 leading-relaxed">
            {{ post.description }}
          </p>
          <div v-if="post.tags.length > 0" class="mt-2.5 flex flex-wrap gap-2">
            <a
              v-for="tag in post.tags"
              :key="tag"
              :href="`/tags?tag=${encodeURIComponent(tag)}`"
              class="text-xs text-muted-foreground hover:text-accent underline decoration-dashed underline-offset-4"
            >
              #{{ tag }}
            </a>
          </div>
        </li>
      </ul>
    </template>

    <!-- MODE: TAGS -->
    <template v-else-if="mode === 'tags'">
      <div v-if="allTags.length === 0" class="text-sm text-muted-foreground italic mb-6">
        No tags found yet. Add a top <code class="text-accent">yaml</code> block with
        <code>tags: [...]</code> or organize posts into subfolders in Outline.
      </div>

      <div v-else class="mb-8 flex flex-wrap gap-2.5 border-b border-dashed border-border pb-6">
        <button
          v-for="t in allTags"
          :key="t.name"
          type="button"
          @click="selectTag(t.name)"
          class="cursor-pointer rounded border px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            selectedTag === t.name
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-background-soft text-foreground hover:border-accent hover:text-accent'
          "
        >
          #{{ t.name }} <span class="opacity-75">({{ t.count }})</span>
        </button>
      </div>

      <ul class="space-y-6">
        <li
          v-for="post in filteredByTag"
          :key="post.url"
          class="group border-b border-dashed border-border/60 pb-5 last:border-none"
        >
          <a :href="post.url" class="inline-block">
            <h3
              class="text-lg font-semibold text-accent decoration-dashed underline-offset-4 group-hover:underline"
            >
              <span v-if="post.icon" class="mr-1.5">{{ post.icon }}</span>
              <span>{{ post.title }}</span>
            </h3>
          </a>
          <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground italic">
            <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            <span>•</span>
            <span>{{ post.readingTime }}</span>
          </div>
          <p v-if="post.description" class="mt-1.5 text-sm text-foreground/90">
            {{ post.description }}
          </p>
        </li>
      </ul>
    </template>
  </div>
</template>
