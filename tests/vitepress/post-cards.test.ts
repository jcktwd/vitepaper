import { describe, expect, it } from 'vitest'
import {
  draftPosts,
  homePosts,
  postsWithTag,
  publishedPosts,
  readingTime,
  tagCounts,
  toPostItem,
  toPostItems,
  type PostItem,
} from '../../content/.vitepress/theme/post-cards.ts'

function card(slug: string, overrides: Partial<PostItem> = {}): PostItem {
  return {
    title: slug,
    url: `/posts/${slug}`,
    date: '2026-01-01T00:00:00.000Z',
    description: '',
    tags: [],
    featured: false,
    draft: false,
    excludeFromPosts: false,
    readingTime: '1 min read',
    ...overrides,
  }
}

describe('readingTime', () => {
  it('counts body words at 200 wpm, ignoring frontmatter, minimum 1 minute', () => {
    expect(readingTime(undefined)).toBe('1 min read')
    expect(readingTime(`---\ntitle: ${'x '.repeat(500)}\n---\nshort`)).toBe('1 min read')
    expect(readingTime('word '.repeat(201))).toBe('2 min read')
  })
})

describe('toPostItem', () => {
  it('maps frontmatter to card fields with normalized dates', () => {
    const item = toPostItem({
      url: '/posts/a',
      frontmatter: {
        title: 'A',
        date: '2026-03-04T05:06:07Z',
        updated: '2026-04-01',
        description: 'Desc',
        icon: '🚀',
        tags: ['x'],
        featured: true,
      },
      src: 'one two',
    })
    expect(item).toEqual({
      title: 'A',
      url: '/posts/a',
      date: '2026-03-04T05:06:07.000Z',
      updated: '2026-04-01T00:00:00.000Z',
      description: 'Desc',
      icon: '🚀',
      tags: ['x'],
      featured: true,
      draft: false,
      excludeFromPosts: false,
      readingTime: '1 min read',
    })
  })

  it('falls back safely for missing or malformed fields', () => {
    const now = new Date('2026-10-16T00:00:00Z')
    const item = toPostItem({ url: '/posts/b', frontmatter: { tags: 'not-a-list' } }, now)
    expect(item).toMatchObject({ title: 'Untitled', date: now.toISOString(), description: '', tags: [], featured: false })
    expect(item.updated).toBeUndefined()
  })
})

describe('toPostItems', () => {
  it('sorts newest first', () => {
    const items = toPostItems([
      { url: '/old', frontmatter: { date: '2025-01-01' } },
      { url: '/new', frontmatter: { date: '2026-06-01' } },
      { url: '/mid', frontmatter: { date: '2025-06-01' } },
    ])
    expect(items.map((p) => p.url)).toEqual(['/new', '/mid', '/old'])
  })
})

const posts = [
  card('featured-new', { featured: true, tags: ['hardware'], date: '2026-05-01T00:00:00Z' }),
  card('recent-1', { tags: ['hardware', 'linux'], date: '2026-04-01T00:00:00Z' }),
  card('draft', { draft: true, excludeFromPosts: true, featured: true, tags: ['secret'] }),
  card('about', { excludeFromPosts: true, tags: ['meta'] }),
  card('recent-2', { tags: ['linux'], date: '2026-03-01T00:00:00Z' }),
  card('recent-3', { date: '2026-02-01T00:00:00Z' }),
]
const urls = (list: PostItem[]) => list.map((p) => p.url.replace('/posts/', ''))

describe('listings', () => {
  it('public listings never include drafts or unlisted pages', () => {
    expect(urls(publishedPosts(posts))).toEqual(['featured-new', 'recent-1', 'recent-2', 'recent-3'])
    expect(urls(draftPosts(posts))).toEqual(['draft'])
  })

  it('home shows featured posts, then recent non-featured posts up to the limit', () => {
    const { featured, recent } = homePosts(posts, 2)
    expect(urls(featured)).toEqual(['featured-new'])
    expect(urls(recent)).toEqual(['recent-1', 'recent-2'])
  })

  it('home "recent" includes everything when nothing is featured', () => {
    const { featured, recent } = homePosts(posts.map((p) => ({ ...p, featured: false })), 10)
    expect(featured).toEqual([])
    expect(urls(recent)).toEqual(['featured-new', 'recent-1', 'recent-2', 'recent-3'])
  })

  it('counts tags from published posts only, most used first', () => {
    expect(tagCounts(posts)).toEqual([
      { name: 'hardware', count: 2 },
      { name: 'linux', count: 2 },
    ])
  })

  it('filters by tag, or shows everything published without one', () => {
    expect(urls(postsWithTag(posts, 'linux'))).toEqual(['recent-1', 'recent-2'])
    expect(urls(postsWithTag(posts, 'secret'))).toEqual([])
    expect(postsWithTag(posts, '')).toHaveLength(4)
  })
})
