import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildEndGenerateOpenGraphImages } from '@nolebase/vitepress-plugin-og-image/vitepress'
import type { ContentData, SiteConfig } from 'vitepress'

interface OgImageOptions {
  baseUrl: string
  siteTitle: string
  author: string
}

/** Generates AstroPaper-branded `og-*.png` social cards for every page and post. */
export async function generateOgImages(
  site: SiteConfig,
  posts: ContentData[],
  { baseUrl, siteTitle, author }: OgImageOptions
): Promise<void> {
  // The OG plugin discovers pages via the sidebar, so populate a virtual one listing all pages & posts
  site.site.themeConfig.sidebar = [
    { text: siteTitle, link: '/' },
    { text: 'Posts', link: '/posts' },
    { text: 'Tags', link: '/tags' },
    ...(existsSync(path.join(site.srcDir, 'drafts.md')) ? [{ text: 'Drafts', link: '/drafts' }] : []),
    ...posts.map((p) => ({
      text: p.frontmatter.title || 'Untitled',
      link: p.url.replace(/\.html$/, ''),
    })),
  ]

  // The card's subtitle is the site description; temporarily swap in "<author> • <domain>"
  const origDescription = site.site.description
  const domainLabel = baseUrl.replace(/^https?:\/\//, '')
  site.site.description = author ? `${author}  •  ${domainLabel}` : domainLabel

  try {
    await buildEndGenerateOpenGraphImages({
      baseUrl,
      maxCharactersPerLine: 26,
      category: {
        byCustomGetter: (page) => {
          const tags = page.frontmatter?.tags
          if (Array.isArray(tags) && tags.length > 0 && tags[0]) {
            return `#${String(tags[0]).trim()}`
          }
          if (page.sourceFilePath.startsWith('/posts/')) {
            return 'Article'
          }
          return siteTitle
        },
      },
    })(site)
  } finally {
    site.site.description = origDescription
  }
}
