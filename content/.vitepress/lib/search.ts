import type { MarkdownEnv } from 'vitepress'
import { escapeXml } from './xml.ts'

/**
 * Local search `_render` hook: excludes drafts and `search: false` pages, and prepends each post's
 * title, description and tags as boosted heading sections so they rank above body matches.
 */
export function renderSearchEntry(
  src: string,
  env: MarkdownEnv,
  // Structural type: VitePress types this `md` against a different markdown-it typing than `MarkdownRenderer`
  md: { render(src: string, env: MarkdownEnv): string }
): string {
  const html = md.render(src, env)
  const fm = env.frontmatter ?? {}
  if (fm.draft || env.relativePath === 'drafts.md' || fm.search === false) {
    return ''
  }

  const rawTitle = fm.title ? String(fm.title).trim() : ''
  if (!rawTitle) {
    return html
  }

  const icon = fm.icon ? `${String(fm.icon).trim()} ` : ''
  const fullTitle = `${icon}${rawTitle}`
  const description = fm.description ? String(fm.description).trim() : ''
  const tags: string[] = Array.isArray(fm.tags)
    ? fm.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
    : []

  const tagsDisplay = tags.map((t) => `#${t}`).join(' ')
  const tagsSearchable = tags.map((t) => `#${t} ${t.replace(/-/g, ' ')}`).join(' ')

  const prefixParts: string[] = [
    `<h1 id="post-title">${escapeXml(fullTitle)} <a class="header-anchor" href="#post-title">&#8203;</a></h1>`,
    `<p>${escapeXml(rawTitle)} ${escapeXml(description)} ${escapeXml(tagsSearchable)}</p>`,
  ]

  const metaSummary = [tagsDisplay, description].filter(Boolean).join(' · ')
  if (metaSummary) {
    prefixParts.push(
      `<h6 id="post-summary">${escapeXml(metaSummary)} <a class="header-anchor" href="#post-summary">&#8203;</a></h6>`,
      `<p>${escapeXml(rawTitle)} ${escapeXml(tagsSearchable)} ${escapeXml(description)}</p>`
    )
  }

  return `${prefixParts.join('\n')}\n${html}`
}
