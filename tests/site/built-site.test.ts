/**
 * Checks the HTML of the fixture site built by `scripts/build-fixture-site.ts` from
 * `tests/fixtures/outline-docs.ts`. Run with `pnpm test:site` (builds first).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parse, type HTMLElement } from 'node-html-parser'
import { describe, expect, it } from 'vitest'

const DIST = path.resolve('fixture-content/.vitepress/dist')

if (!existsSync(DIST)) {
  throw new Error('No fixture site found: run `pnpm test:site` (it builds fixture-content/ first)')
}

const read = (file: string) => readFileSync(path.join(DIST, file), 'utf8')
const page = (file: string): HTMLElement => parse(read(file))

/** Card links rendered by <PostList /> on a page, in order, as slugs */
const cardSlugs = (root: HTMLElement) =>
  root.querySelectorAll('a.vp-post-card-link').map((a) => a.getAttribute('href')!.replace(/^\/posts\//, ''))

const PUBLISHED = ['featured-teardown', 'linux-notes', 'older-post']

describe('post cards', () => {
  it('home shows the featured post, then recent posts, and nothing unlisted', () => {
    const home = page('index.html')
    const sections = home.querySelectorAll('section')
    const featured = sections.find((s) => s.querySelector('h2')?.text.trim() === 'Featured')!
    const recent = sections.find((s) => s.querySelector('h2')?.text.trim() === 'Recent Posts')!

    expect(cardSlugs(featured)).toEqual(['featured-teardown'])
    expect(cardSlugs(recent)).toEqual(['linux-notes', 'older-post'])
  })

  it('the posts page lists every published post, newest first, without the newer draft', () => {
    expect(cardSlugs(page('posts.html'))).toEqual(PUBLISHED)
  })

  it('the tags page counts only published posts', () => {
    const tags = page('tags.html')
      .querySelectorAll('.not-prose button')
      .map((b) => b.text.replace(/\s+/g, ' ').trim())
    expect(tags).toEqual(['#hardware (2)', '#linux (2)'])
    expect(cardSlugs(page('tags.html'))).toEqual(PUBLISHED)
  })

  it('cards show the title, description, reading time and tag links', () => {
    const card = page('posts.html').querySelector('a.vp-post-card-link[href="/posts/featured-teardown"]')!.parentNode!
    expect(card.querySelector('.vp-post-card-title')!.text.trim()).toBe('Featured Teardown')
    expect(card.querySelector('p')!.text.trim()).toBe('A teardown of a Vec<String> parser that prints {{ 1 + 1 }} literally.')
    expect(card.text).toContain('1 min read')
    expect(card.querySelectorAll('a[href^="/tags?tag="]').map((a) => a.text.trim())).toEqual(['#hardware'])
  })

  it('every card links to a page that exists', () => {
    for (const file of ['index.html', 'posts.html', 'tags.html', 'drafts.html']) {
      for (const slug of cardSlugs(page(file))) {
        expect(existsSync(path.join(DIST, 'posts', `${slug}.html`)), `${file} -> ${slug}`).toBe(true)
      }
    }
  })

  it('the drafts preview lists the draft', () => {
    expect(cardSlugs(page('drafts.html'))).toEqual(['secret-draft'])
  })
})

describe('unlisted pages', () => {
  it('drafts are built but noindex, and kept out of the sitemap and RSS', () => {
    expect(page('posts/secret-draft.html').querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    expect(read('sitemap.xml')).not.toContain('secret-draft')
    expect(read('rss.xml')).not.toContain('secret-draft')
  })

  it('the RSS feed has exactly the published posts, newest first', () => {
    const links = [...read('rss.xml').matchAll(/<item>[\s\S]*?<link>[^<]*\/posts\/([^<]+)<\/link>/g)].map((m) => m[1])
    expect(links).toEqual(PUBLISHED)
  })

  it('a page pinned with `nav:` is in the navbar but not the post lists', () => {
    const navLinks = page('index.html').querySelectorAll('.VPNavBarMenuLink').map((a) => a.text.trim())
    expect(navLinks).toContain('About')
    expect(cardSlugs(page('posts.html'))).not.toContain('about-me')
  })
})

describe('social cards (OpenGraph)', () => {
  // The fixture site builds with the default config's URL
  const SITE = 'https://example.com'
  const metas = (root: HTMLElement, key: string) =>
    root
      .querySelectorAll('meta')
      .filter((m) => m.getAttribute('property') === key || m.getAttribute('name') === key)
      .map((m) => m.getAttribute('content'))
  /** Width and height from a PNG's IHDR chunk */
  const pngSize = (file: string) => {
    const buf = readFileSync(file)
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }

  const FIXTURE_DATES: Record<string, string> = {
    'featured-teardown': '2026-05-01T09:00:00.000Z',
    'linux-notes': '2026-04-01T09:00:00.000Z',
    'older-post': '2026-03-01T09:00:00.000Z',
  }

  it.each(PUBLISHED)('%s is an article with canonical URL, dates, tags and a 1200x630 image', (slug) => {
    const html = page(`posts/${slug}.html`)
    const url = `${SITE}/posts/${slug}`

    expect(metas(html, 'og:type')).toEqual(['article'])
    expect(html.querySelectorAll('link[rel="canonical"]').map((l) => l.getAttribute('href'))).toEqual([url])
    expect(metas(html, 'og:url')).toEqual([url])
    expect(metas(html, 'og:site_name')).toHaveLength(1)
    expect(metas(html, 'og:image:alt')[0]).toMatch(/ \| /)
    expect(metas(html, 'article:published_time')).toEqual([FIXTURE_DATES[slug]])
    expect(metas(html, 'article:tag').length).toBeGreaterThan(0)

    const image = `${SITE}/posts/og-${slug}.png`
    expect(metas(html, 'og:image')).toEqual([image])
    expect(metas(html, 'twitter:image')).toEqual([image])
    expect(metas(html, 'twitter:card')).toEqual(['summary_large_image'])
    expect(pngSize(path.join(DIST, 'posts', `og-${slug}.png`))).toEqual({ width: 1200, height: 630 })
  })

  it('pages that are not posts are websites', () => {
    expect(metas(page('index.html'), 'og:type')).toEqual(['website'])
    expect(metas(page('index.html'), 'og:url')).toEqual([`${SITE}/`])
    expect(metas(page('posts/about-me.html'), 'og:type')).toEqual(['website'])
    expect(metas(page('posts/about-me.html'), 'article:published_time')).toEqual([])
  })

  it('every page has exactly one of each identity tag', () => {
    for (const file of ['index.html', 'posts.html', 'tags.html', ...PUBLISHED.map((s) => `posts/${s}.html`)]) {
      const html = page(file)
      for (const key of ['og:type', 'og:url', 'og:title', 'og:image', 'og:site_name']) {
        expect(metas(html, key), `${file} ${key}`).toHaveLength(1)
      }
      expect(html.querySelectorAll('link[rel="canonical"]'), `${file} canonical`).toHaveLength(1)
    }
  })
})

describe('page transitions', () => {
  const css = () => {
    const file = readdirSync(path.join(DIST, 'assets')).find((f) => /^style\..+\.css$/.test(f))!
    return read(path.join('assets', file)).replace(/\s+/g, '')
  }

  it('give the fixed chrome its own transition layers, stacked above the content', () => {
    const styles = css()
    for (const name of ['vp-nav', 'vp-local-nav', 'vp-reading-progress']) {
      expect(styles, name).toContain(`view-transition-name:${name}`)
      expect(styles, name).toMatch(new RegExp(`::view-transition-group\\(${name}\\)[^{]*\\{[^}]*z-index:1`))
    }
  })
})

describe('table of contents', () => {
  it('posts have the right sidebar TOC with their headings', () => {
    const aside = page('posts/featured-teardown.html').querySelector('.VPDoc .aside')
    expect(aside).not.toBeNull()
  })

  it('listing pages have no (empty) TOC column pushing the list off-centre', () => {
    for (const file of ['index.html', 'posts.html', 'tags.html', 'drafts.html']) {
      expect(page(file).querySelector('.VPDoc .aside'), file).toBeNull()
    }
  })
})

describe('reading progress bar', () => {
  const bars = (file: string) =>
    page(file).querySelectorAll('div').filter((d) => d.classList.contains('fixed') && d.classList.contains('top-0') && d.classList.contains('z-50'))

  it('is on posts, outside .VPContent so the navbar cannot paint over it', () => {
    // .VPContent has a view-transition-name, making it a stacking context below the fixed navbar
    const found = bars('posts/featured-teardown.html')
    expect(found).toHaveLength(1)
    expect(found[0].closest('.VPContent')).toBeNull()
  })

  it('lets the pointer through to the navbar reveal zone underneath it', () => {
    expect(bars('posts/featured-teardown.html')[0].classList.contains('pointer-events-none')).toBe(true)
  })

  it('is not on listing pages', () => {
    expect(bars('index.html')).toHaveLength(0)
    expect(bars('posts.html')).toHaveLength(0)
  })
})

describe('post pages', () => {
  const featured = () => page('posts/featured-teardown.html')

  it('render Outline text literally instead of as HTML or Vue', () => {
    const text = featured().querySelector('.vp-doc')!.text
    expect(text).toContain('A teardown of a Vec<String> parser that prints {{ 1 + 1 }} literally.')
  })

  it('keep the HTML Outline emits itself: table line breaks and autolinks', () => {
    const doc = featured().querySelector('.vp-doc')!
    expect(doc.querySelector('td br')).not.toBeNull()
    expect(doc.querySelector('a[href="https://example.com/autolink"]')).not.toBeNull()
  })

  it('rewrite cross-document links and show backlinks on the target', () => {
    expect(featured().querySelector('.vp-doc a[href="/posts/linux-notes"]')).not.toBeNull()
    const backlinks = page('posts/linux-notes.html').querySelectorAll('a.vp-backlink-item').map((a) => a.getAttribute('href'))
    expect(backlinks).toEqual(['/posts/featured-teardown'])
  })

  it('render footnotes', () => {
    expect(featured().querySelector('section.footnotes li#fn1')?.text).toContain('With a logic analyser.')
  })
})
