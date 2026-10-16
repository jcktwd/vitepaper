import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

export interface NavItem {
  text: string
  link: string
  activeMatch: string
}

/** Slug and parsed frontmatter of every synced post (posts with missing or invalid frontmatter are skipped) */
export function readPostsFrontmatter(postsDir: string): Array<{ slug: string; fm: Record<string, any> }> {
  if (!existsSync(postsDir)) return []
  const posts: Array<{ slug: string; fm: Record<string, any> }> = []

  for (const file of readdirSync(postsDir)) {
    if (!file.endsWith('.md')) continue
    const raw = readFileSync(path.join(postsDir, file), 'utf8')
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch) continue
    try {
      const fm = YAML.parse(fmMatch[1])
      if (fm && typeof fm === 'object') posts.push({ slug: file.replace(/\.md$/, ''), fm })
    } catch {
      // Ignore invalid frontmatter
    }
  }
  return posts
}

/** Slugs of draft posts: built for `/drafts` previews, but kept out of the sitemap */
export function getDraftSlugs(postsDir: string): Set<string> {
  return new Set(readPostsFrontmatter(postsDir).filter(({ fm }) => fm.draft).map(({ slug }) => slug))
}

/**
 * Dynamically discovers synced Outline articles that have `nav: <label>` in frontmatter
 * so any Outline article can appear on the top navigation bar automatically.
 */
export function getOutlineNavItems(postsDir: string): NavItem[] {
  const items: Array<NavItem & { order: number }> = readPostsFrontmatter(postsDir)
    .filter(({ fm }) => fm.nav && !fm.draft)
    .map(({ slug, fm }) => ({
      text: typeof fm.nav === 'string' ? fm.nav : fm.title || slug,
      link: `/posts/${slug}`,
      activeMatch: `^/posts/${slug}`,
      order: Number(fm.navOrder ?? 50),
    }))

  return items
    .sort((a, b) => a.order - b.order || a.text.localeCompare(b.text))
    .map(({ text, link, activeMatch }) => ({ text, link, activeMatch }))
}

/**
 * `activeMatch` for the "Posts" nav item that excludes posts pinned to the navbar,
 * so e.g. `/posts/about-me` highlights "About Me" rather than "Posts".
 */
export function buildPostsActiveMatch(navItems: NavItem[]): string {
  const navSlugs = navItems.map((item) => item.link.replace(/^\/posts\//, '')).filter(Boolean)
  return navSlugs.length > 0
    ? `^/posts(?:$|/(?!(?:${navSlugs.join('|')})(?:$|/|\\.html)))`
    : '^/posts'
}
