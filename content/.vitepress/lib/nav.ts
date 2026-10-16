import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

export interface NavItem {
  text: string
  link: string
  activeMatch: string
}

/**
 * Dynamically discovers synced Outline articles that have `nav: <label>` in frontmatter
 * so any Outline article can appear on the top navigation bar automatically.
 */
export function getOutlineNavItems(postsDir: string): NavItem[] {
  if (!existsSync(postsDir)) return []
  const items: Array<NavItem & { order: number }> = []

  for (const file of readdirSync(postsDir)) {
    if (!file.endsWith('.md')) continue
    const raw = readFileSync(path.join(postsDir, file), 'utf8')
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch) continue
    try {
      const fm = YAML.parse(fmMatch[1])
      if (fm && fm.nav && !fm.draft) {
        const slug = file.replace(/\.md$/, '')
        const label = typeof fm.nav === 'string' ? fm.nav : fm.title || slug
        items.push({
          text: label,
          link: `/posts/${slug}`,
          activeMatch: `^/posts/${slug}`,
          order: Number(fm.navOrder ?? 50),
        })
      }
    } catch {
      // Ignore invalid frontmatter
    }
  }

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
