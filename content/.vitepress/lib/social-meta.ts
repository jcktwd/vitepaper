import type { HeadConfig } from 'vitepress'

export interface SocialMetaInput {
  /** Page source path relative to the content dir, e.g. `posts/my-post.md` */
  relativePath: string
  frontmatter: Record<string, any>
  /** Canonical site URL without a trailing slash */
  baseUrl: string
  siteTitle: string
}

/** Clean URL path for a page (`cleanUrls`): `index.md` -> `/`, `posts/a.md` -> `/posts/a` */
export function pagePath(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.md$/, '')
  if (withoutExt === 'index') return '/'
  return '/' + withoutExt.replace(/\/index$/, '/')
}

/** A post page (as opposed to a listing or a page pinned to the navbar with `excludeFromPosts`) */
export function isArticle(relativePath: string, frontmatter: Record<string, any>): boolean {
  return relativePath.startsWith('posts/') && !frontmatter.excludeFromPosts
}

const iso = (value: unknown): string | undefined => {
  if (!value) return undefined
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/**
 * Canonical link, `og:title`, `og:url`, `og:site_name`, `og:type`, OG image alt text, and for posts
 * the `article:*` tags. (`og:description` comes from @nolebase/vitepress-plugin-meta, and `og:image`
 * from the OG image plugin at build end.) Returns nothing for the 404 page.
 */
export function buildSocialMeta({ relativePath, frontmatter, baseUrl, siteTitle }: SocialMetaInput): HeadConfig[] {
  if (relativePath === '404.md') return []

  const url = `${baseUrl}${pagePath(relativePath)}`
  const title = typeof frontmatter.title === 'string' && frontmatter.title.trim() ? frontmatter.title.trim() : siteTitle
  const imageAlt = title === siteTitle ? siteTitle : `${title} | ${siteTitle}`

  const head: HeadConfig[] = [
    ['link', { rel: 'canonical', href: url }],
    // The meta plugin only sets og:title for pages with a title, which leaves the home page without one
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:url', content: url }],
    ['meta', { property: 'og:site_name', content: siteTitle }],
    ['meta', { property: 'og:image:alt', content: imageAlt }],
    ['meta', { name: 'twitter:image:alt', content: imageAlt }],
  ]

  if (!isArticle(relativePath, frontmatter)) {
    head.push(['meta', { property: 'og:type', content: 'website' }])
    return head
  }

  head.push(['meta', { property: 'og:type', content: 'article' }])
  const published = iso(frontmatter.date)
  const modified = iso(frontmatter.updated)
  if (published) head.push(['meta', { property: 'article:published_time', content: published }])
  if (modified) head.push(['meta', { property: 'article:modified_time', content: modified }])
  if (typeof frontmatter.author === 'string' && frontmatter.author.trim()) {
    head.push(['meta', { property: 'article:author', content: frontmatter.author.trim() }])
  }
  for (const tag of Array.isArray(frontmatter.tags) ? frontmatter.tags : []) {
    head.push(['meta', { property: 'article:tag', content: String(tag) }])
  }
  return head
}

/**
 * Sets the page's `og:type` in built HTML. Needed after OG image generation: the plugin re-runs
 * `rehype-meta` over every page, which rewrites `og:type` to its default, `website`.
 */
export function setOgType(html: string, type: 'article' | 'website'): string {
  return html.replace(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="${type}">`)
}

/** The identity of a head entry for de-duplication: `canonical`, `og:type`, … (or null if it has none) */
function headKey([tag, attrs]: HeadConfig): string | null {
  if (tag === 'link' && attrs.rel === 'canonical') return 'canonical'
  if (tag !== 'meta') return null
  return attrs.property ?? attrs.name ?? null
}

/**
 * Appends `extra` to `head`, first dropping existing entries it replaces (e.g. the meta plugin's
 * `og:type`). Repeatable tags like `article:tag` in `extra` are all kept.
 */
export function mergeHead(head: HeadConfig[], extra: HeadConfig[]): HeadConfig[] {
  const replaced = new Set(extra.map(headKey).filter((k): k is string => k !== null))
  return [...head.filter((entry) => !replaced.has(headKey(entry) ?? '')), ...extra]
}
