import { describe, expect, it } from 'vitest'
import { cacheControlFor, IMMUTABLE, REVALIDATE } from '../../scripts/server/cache-control.ts'

describe('cacheControlFor', () => {
  it('caches hashed build assets for a year', () => {
    expect(cacheControlFor('/assets/style.DmkGH1Z_.css')).toBe(IMMUTABLE)
    expect(cacheControlFor('/assets/chunks/theme.C8O4K86L.js')).toBe(IMMUTABLE)
  })

  it('revalidates pages, including clean URLs (sirv passes the request path, not the .html file)', () => {
    for (const path of ['/', '/posts', '/posts/vitepaper-article', '/tags', '/posts/vitepaper-article.html', '/404.html']) {
      expect(cacheControlFor(path), path).toBe(REVALIDATE)
    }
  })

  it('treats a page slug containing a dot as a page', () => {
    expect(cacheControlFor('/posts/release-v1.2')).toBe(REVALIDATE)
  })

  it('leaves other static files to the browser default', () => {
    for (const path of ['/posts/og-vitepaper-article.png', '/attachments/abc.webp', '/rss.xml', '/sitemap.xml', '/favicon.ico', '/attachments/clip.mp4']) {
      expect(cacheControlFor(path), path).toBeNull()
    }
  })
})
