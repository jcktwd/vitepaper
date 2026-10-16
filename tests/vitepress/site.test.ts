import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveSiteLogo } from '../../content/.vitepress/lib/logo.ts'
import { buildPostsActiveMatch, getDraftSlugs, getOutlineNavItems } from '../../content/.vitepress/lib/nav.ts'
import { buildRssXml } from '../../content/.vitepress/lib/rss.ts'
import { addPublicAliases } from '../../content/.vitepress/lib/thumbhash.ts'
import { escapeXml } from '../../content/.vitepress/lib/xml.ts'

describe('escapeXml', () => {
  it('escapes all five XML entities', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;')
  })
})

describe('buildRssXml', () => {
  it('renders a valid channel with escaped items', () => {
    const xml = buildRssXml({
      title: 'Blog & Notes',
      description: 'desc',
      baseUrl: 'https://example.com',
      items: [{ title: 'A <b>post</b>', url: 'https://example.com/posts/a', date: '2026-01-02T03:04:05.000Z', description: 'x' }],
    })
    expect(xml).toContain('<title>Blog &amp; Notes</title>')
    expect(xml).toContain('<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>')
    expect(xml).toContain('<title>A &lt;b&gt;post&lt;/b&gt;</title>')
    expect(xml).toContain('<pubDate>Fri, 02 Jan 2026 03:04:05 GMT</pubDate>')
  })
})

describe('resolveSiteLogo', () => {
  it('turns Iconify ids into themed Iconify URLs', () => {
    const { navLogo, faviconHref } = resolveSiteLogo('lucide:book-open')
    expect(navLogo).toEqual({
      light: 'https://api.iconify.design/lucide/book-open.svg?color=%23e14a39',
      dark: 'https://api.iconify.design/lucide/book-open.svg?color=%23ff6b01',
    })
    expect(faviconHref).toBe('https://api.iconify.design/lucide/book-open.svg?color=%23e14a39')
  })

  it('passes paths and theme objects through', () => {
    expect(resolveSiteLogo('/logo.svg')).toEqual({ navLogo: '/logo.svg', faviconHref: '/logo.svg' })
    expect(resolveSiteLogo({ light: '/l.svg', dark: '/d.svg' }).faviconHref).toBe('/l.svg')
    expect(resolveSiteLogo(undefined)).toEqual({ navLogo: undefined, faviconHref: undefined })
  })
})

describe('getOutlineNavItems', () => {
  let dir: string | undefined
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  it('lists non-draft posts with `nav`, ordered by navOrder then label', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'vitepaper-nav-'))
    writeFileSync(path.join(dir, 'about-me.md'), '---\ntitle: About\nnav: About Me\nnavOrder: 30\n---\nx')
    writeFileSync(path.join(dir, 'uses.md'), '---\ntitle: Uses\nnav: true\nnavOrder: 10\n---\nx')
    writeFileSync(path.join(dir, 'draft.md'), '---\nnav: Draft\ndraft: true\n---\nx')
    writeFileSync(path.join(dir, 'post.md'), '---\ntitle: Post\n---\nx')

    expect(getOutlineNavItems(dir)).toEqual([
      { text: 'Uses', link: '/posts/uses', activeMatch: '^/posts/uses' },
      { text: 'About Me', link: '/posts/about-me', activeMatch: '^/posts/about-me' },
    ])
  })

  it('returns nothing when the posts directory does not exist', () => {
    expect(getOutlineNavItems(path.join(tmpdir(), 'vitepaper-missing-dir'))).toEqual([])
  })

  it('getDraftSlugs finds drafts and skips posts without valid frontmatter', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'vitepaper-drafts-'))
    writeFileSync(path.join(dir, 'secret.md'), '---\ntitle: Secret\ndraft: true\n---\nx')
    writeFileSync(path.join(dir, 'public.md'), '---\ntitle: Public\n---\nx')
    writeFileSync(path.join(dir, 'broken.md'), '---\n: : bad yaml [\n---\nx')
    writeFileSync(path.join(dir, 'none.md'), 'no frontmatter')

    expect([...getDraftSlugs(dir)]).toEqual(['secret'])
  })
})

describe('buildPostsActiveMatch', () => {
  it('excludes navbar-pinned posts from the Posts item', () => {
    const re = new RegExp(buildPostsActiveMatch([{ text: 'About', link: '/posts/about-me', activeMatch: '' }]))
    expect(re.test('/posts')).toBe(true)
    expect(re.test('/posts/some-post')).toBe(true)
    expect(re.test('/posts/about-me')).toBe(false)
    expect(re.test('/posts/about-me.html')).toBe(false)
    expect(re.test('/posts/about-me-too')).toBe(true)
  })

  it('matches every post when nothing is pinned', () => {
    expect(buildPostsActiveMatch([])).toBe('^/posts')
  })
})

describe('addPublicAliases', () => {
  it('aliases public/ entries without the prefix and webp entries as .webp.png', () => {
    const map: Record<string, unknown> = { 'public/attachments/a.webp': 1, 'public/b.png': 2 }
    expect(addPublicAliases(map)).toBe(true)
    expect(map).toMatchObject({
      'attachments/a.webp': 1,
      'attachments/a.webp.png': 1,
      'public/attachments/a.webp.png': 1,
      'b.png': 2,
    })
    expect(addPublicAliases(map)).toBe(false)
  })
})
