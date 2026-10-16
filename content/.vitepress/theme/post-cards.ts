/**
 * Post card data and which cards each listing shows. Shared by `posts.data.ts` (build time) and
 * `<PostList />` (render), and kept free of Vue/VitePress so it can be unit-tested.
 */

export interface PostItem {
  title: string
  url: string
  date: string
  updated?: string
  description: string
  icon?: string
  tags: string[]
  featured: boolean
  draft: boolean
  excludeFromPosts: boolean
  readingTime: string
}

/** What `createContentLoader` hands us for each post (with `includeSrc`) */
export interface RawPost {
  url: string
  frontmatter: Record<string, any>
  src?: string
}

const WORDS_PER_MINUTE = 200

export function readingTime(src: string | undefined): string {
  const body = (src || '').replace(/^---[\s\S]*?---/, '').trim()
  const words = body ? body.split(/\s+/).length : 0
  return `${Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))} min read`
}

/**
 * Card data for one post. `now` is the fallback date for posts without one (so they sort first).
 */
export function toPostItem({ url, frontmatter, src }: RawPost, now: Date = new Date()): PostItem {
  return {
    title: frontmatter.title || 'Untitled',
    url,
    date: frontmatter.date ? new Date(frontmatter.date).toISOString() : now.toISOString(),
    updated: frontmatter.updated ? new Date(frontmatter.updated).toISOString() : undefined,
    description: frontmatter.description || '',
    icon: frontmatter.icon,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    featured: Boolean(frontmatter.featured),
    draft: Boolean(frontmatter.draft),
    excludeFromPosts: Boolean(frontmatter.excludeFromPosts),
    readingTime: readingTime(src),
  }
}

/** All posts as cards, newest first */
export function toPostItems(raw: RawPost[], now: Date = new Date()): PostItem[] {
  return raw
    .map((post) => toPostItem(post, now))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** Posts shown in public listings: never drafts or pages kept out of the post list */
export function publishedPosts(posts: PostItem[]): PostItem[] {
  return posts.filter((p) => !p.excludeFromPosts && !p.draft)
}

export function draftPosts(posts: PostItem[]): PostItem[] {
  return posts.filter((p) => p.draft)
}

/**
 * The home page: every featured post, then up to `limit` recent ones. When anything is featured,
 * "recent" skips featured posts so none appears twice.
 */
export function homePosts(posts: PostItem[], limit: number): { featured: PostItem[]; recent: PostItem[] } {
  const published = publishedPosts(posts)
  const featured = published.filter((p) => p.featured)
  const recentPool = featured.length > 0 ? published.filter((p) => !p.featured) : published
  return { featured, recent: recentPool.slice(0, limit) }
}

/** Tags across published posts, most used first, then alphabetical */
export function tagCounts(posts: PostItem[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const post of publishedPosts(posts)) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Published posts with `tag`, or all of them when no tag is selected */
export function postsWithTag(posts: PostItem[], tag: string): PostItem[] {
  const published = publishedPosts(posts)
  return tag ? published.filter((p) => p.tags.includes(tag)) : published
}
