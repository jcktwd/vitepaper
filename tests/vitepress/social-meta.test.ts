import { describe, expect, it } from 'vitest'
import { parseGoogleFontsCss } from '../../content/.vitepress/lib/fonts.ts'
import { buildSocialMeta, isArticle, mergeHead, pagePath, setOgType } from '../../content/.vitepress/lib/social-meta.ts'

const base = { baseUrl: 'https://blog.example', siteTitle: 'Exit Node' }
const meta = (head: ReturnType<typeof buildSocialMeta>, key: string) =>
  head.filter(([, a]) => a.property === key || a.name === key).map(([, a]) => a.content)

describe('pagePath', () => {
  it('maps source files to clean URLs', () => {
    expect(pagePath('index.md')).toBe('/')
    expect(pagePath('posts.md')).toBe('/posts')
    expect(pagePath('posts/my-post.md')).toBe('/posts/my-post')
    expect(pagePath('guide/index.md')).toBe('/guide/')
  })
})

describe('isArticle', () => {
  it('is true for posts, false for listings and pages kept out of the post list', () => {
    expect(isArticle('posts/a.md', {})).toBe(true)
    expect(isArticle('posts/about-me.md', { excludeFromPosts: true })).toBe(false)
    expect(isArticle('posts.md', {})).toBe(false)
    expect(isArticle('index.md', {})).toBe(false)
  })
})

describe('buildSocialMeta', () => {
  it('gives posts article metadata', () => {
    const head = buildSocialMeta({
      ...base,
      relativePath: 'posts/teardown.md',
      frontmatter: { title: 'Teardown', date: '2026-05-01T09:00:00Z', updated: '2026-06-01', author: 'Jack', tags: ['hardware', 'linux'] },
    })
    expect(head).toContainEqual(['link', { rel: 'canonical', href: 'https://blog.example/posts/teardown' }])
    expect(meta(head, 'og:url')).toEqual(['https://blog.example/posts/teardown'])
    expect(meta(head, 'og:site_name')).toEqual(['Exit Node'])
    expect(meta(head, 'og:type')).toEqual(['article'])
    expect(meta(head, 'og:image:alt')).toEqual(['Teardown | Exit Node'])
    expect(meta(head, 'twitter:image:alt')).toEqual(['Teardown | Exit Node'])
    expect(meta(head, 'article:published_time')).toEqual(['2026-05-01T09:00:00.000Z'])
    expect(meta(head, 'article:modified_time')).toEqual(['2026-06-01T00:00:00.000Z'])
    expect(meta(head, 'article:author')).toEqual(['Jack'])
    expect(meta(head, 'article:tag')).toEqual(['hardware', 'linux'])
  })

  it('gives other pages website metadata and the site title as image alt', () => {
    const head = buildSocialMeta({ ...base, relativePath: 'index.md', frontmatter: {} })
    expect(meta(head, 'og:type')).toEqual(['website'])
    expect(meta(head, 'og:title')).toEqual(['Exit Node'])
    expect(meta(head, 'og:url')).toEqual(['https://blog.example/'])
    expect(meta(head, 'og:image:alt')).toEqual(['Exit Node'])
    expect(meta(head, 'article:published_time')).toEqual([])
  })

  it('skips invalid dates and the 404 page', () => {
    const head = buildSocialMeta({ ...base, relativePath: 'posts/x.md', frontmatter: { date: 'not a date' } })
    expect(meta(head, 'article:published_time')).toEqual([])
    expect(buildSocialMeta({ ...base, relativePath: '404.md', frontmatter: {} })).toEqual([])
  })
})

describe('mergeHead', () => {
  it('replaces entries it overrides and keeps the rest, including repeated tags', () => {
    const merged = mergeHead(
      [
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: 'T' }],
        ['link', { rel: 'canonical', href: '/old' }],
        ['link', { rel: 'icon', href: '/i.svg' }],
      ],
      [
        ['meta', { property: 'og:type', content: 'article' }],
        ['link', { rel: 'canonical', href: '/new' }],
        ['meta', { property: 'article:tag', content: 'a' }],
        ['meta', { property: 'article:tag', content: 'b' }],
      ]
    )
    expect(merged).toEqual([
      ['meta', { property: 'og:title', content: 'T' }],
      ['link', { rel: 'icon', href: '/i.svg' }],
      ['meta', { property: 'og:type', content: 'article' }],
      ['link', { rel: 'canonical', href: '/new' }],
      ['meta', { property: 'article:tag', content: 'a' }],
      ['meta', { property: 'article:tag', content: 'b' }],
    ])
  })
})

describe('setOgType', () => {
  it('rewrites the og:type meta tag', () => {
    expect(setOgType('<head><meta property="og:type" content="website"></head>', 'article')).toBe(
      '<head><meta property="og:type" content="article"></head>'
    )
  })
})

describe('parseGoogleFontsCss', () => {
  it('lists TrueType faces with weight and style, skipping other formats', () => {
    const css = `
/* latin */
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/a.ttf) format('truetype');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/b.ttf) format('truetype');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/c.woff2) format('woff2');
}`
    expect(parseGoogleFontsCss(css)).toEqual([
      { url: 'https://fonts.gstatic.com/s/a.ttf', weight: '400', style: 'italic' },
      { url: 'https://fonts.gstatic.com/s/b.ttf', weight: '700', style: 'normal' },
    ])
  })
})
