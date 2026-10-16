import YAML from 'yaml'
import type { OutlineDocument } from './outline-api.ts'
import { escapeOutlineText } from './escape.ts'
import { slugify } from './slugify.ts'

/** Outline's named icons mapped to the closest emoji; any other ASCII name is dropped. */
const OUTLINE_ICON_MAP: Record<string, string> = {
  'hands-clapping': '👏',
  terminal: '💻',
  laptop: '💻',
  'laptop-code': '💻',
  lightbulb: '💡',
  pencil: '✏️',
  notepad: '📝',
  newspaper: '📰',
  code: '🧑‍💻',
  bug: '🐛',
  server: '🖥️',
  database: '🗄️',
  globe: '🌐',
  internet: '🌐',
  book: '📖',
  library: '📚',
  collection: '📚',
  train: '🚄',
  rocket: '🚀',
  shield: '🛡️',
  tool: '🔧',
  tools: '🛠️',
  hammer: '🔨',
  microchip: '🎛️',
  beaker: '🧪',
  'flask-vial': '🧪',
  flame: '🔥',
  lightning: '⚡',
  padlock: '🔒',
  vault: '🔐',
  academicCap: '🎓',
  'user-graduate': '🎓',
  'network-wired': '🖧',
}

export function normalizeOutlineIcon(icon?: string | null): string | undefined {
  if (!icon) return undefined
  const trimmed = icon.trim()
  if (OUTLINE_ICON_MAP[trimmed]) return OUTLINE_ICON_MAP[trimmed]
  if (/^[\x20-\x7E]+$/.test(trimmed)) return undefined
  return trimmed
}

export interface SyncedPost {
  slug: string
  frontmatter: Record<string, any>
  body: string
}

export interface ParseOptions {
  /** Document came from the Outline Drafts folder */
  isDraft?: boolean
  /** Author used when neither the YAML block nor Outline names one */
  defaultAuthor?: string
}

/** Strips Markdown syntax from a paragraph and truncates it into a post card / SEO description. */
export function deriveDescription(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#') && !p.startsWith(':::') && !p.startsWith('+++') &&!p.startsWith('```') && !p.startsWith('!['))
    // Footnote definitions and lone Outline video links (`[title WxH](src)`)
    .filter((p) => !/^\[\^[^\]]+\]:/.test(p) && !/^\[[^\]]*\s\d*x\d*\]\([^)]*\.(?:mp4|m4v|webm|ogv|ogg|mov)\)$/i.test(p))

  if (paragraphs.length === 0) return ''

  const description = paragraphs[0]
    .replace(/^[*_]+|[*_]+$/g, '')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/@?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return description.length > 220 ? description.slice(0, 217).trimEnd() + '...' : description
}

/**
 * Turns an Outline document into a VitePress post: extracts the optional top-of-doc YAML block and
 * `Tags:` line, merges tags, and computes slug, dates, icon, draft/nav/listing flags.
 */
export function parseDocumentFrontmatter(
  rawMarkdown: string,
  doc: OutlineDocument,
  inheritedTags: string[],
  { isDraft: isFromDraftsFolder = false, defaultAuthor }: ParseOptions = {}
): SyncedPost {
  let body = rawMarkdown.replace(/\r\n/g, '\n').trim()
  let userMeta: Record<string, any> = {}

  // 1. Extract optional top-of-doc ```yaml or ```frontmatter code block, either bare or inside an
  //    Outline toggle block headed "Metadata" / "Frontmatter" (so it stays collapsed while writing)
  const yamlBlockRe =
    /^(?:```(?:yaml|yml|frontmatter)\n([\s\S]*?)\n```|\+{3,}\n(?:#{1,6}[ \t]+)?(?:metadata|frontmatter)[ \t]*\n+```(?:yaml|yml|frontmatter)\n([\s\S]*?)\n```[ \t]*\n\+{3,})\s*/i
  const yamlMatch = body.match(yamlBlockRe)
  if (yamlMatch) {
    try {
      const parsed = YAML.parse(yamlMatch[1] ?? yamlMatch[2])
      if (parsed && typeof parsed === 'object') {
        userMeta = parsed
      }
      body = body.slice(yamlMatch[0].length).trim()
    } catch (err) {
      console.warn(`  [warn] Failed to parse top YAML block in "${doc.title}":`, err)
    }
  }

  // 2. Also support optional single-line "Tags: #foo, #bar" at the very top of the doc
  const inlineTagsRe = /^tags:\s*(.+)\n+/i
  const inlineTagsMatch = body.match(inlineTagsRe)
  const inlineTags: string[] = []
  if (inlineTagsMatch) {
    inlineTags.push(
      ...inlineTagsMatch[1]
        .split(/[, ]+/)
        .map((t) => slugify(t.replace(/^#/, '')))
        .filter(Boolean)
    )
    body = body.slice(inlineTagsMatch[0].length).trim()
  }

  // 3. Description from YAML override, otherwise the first prose paragraph
  const description: string = userMeta.description || deriveDescription(body)

  // 4. Merge tags (inherited folder tags + inline tags + YAML tags)
  const yamlTags = Array.isArray(userMeta.tags)
    ? userMeta.tags.map((t: unknown) => slugify(String(t))).filter(Boolean)
    : typeof userMeta.tags === 'string'
      ? userMeta.tags.split(',').map((t: string) => slugify(t)).filter(Boolean)
      : []

  const tags = [...new Set([...inheritedTags, ...inlineTags, ...yamlTags])]

  // 5. Slug (clean title slug, overridable via YAML `slug`)
  const slug = slugify(userMeta.slug || doc.title) || doc.urlId.toLowerCase()

  // 6. Dates: `date` defaults to Outline publishedAt/createdAt; `updated` ONLY when explicitly set in YAML
  const date = userMeta.date
    ? new Date(userMeta.date).toISOString()
    : doc.publishedAt || doc.createdAt

  const updated = userMeta.updated ? new Date(userMeta.updated).toISOString() : undefined

  const rawIcon = userMeta.icon !== undefined ? userMeta.icon : doc.icon || doc.emoji || undefined
  const icon = normalizeOutlineIcon(rawIcon)

  // 7. Draft & Top-navbar (`nav`) / `excludeFromPosts` support
  const isDraft = Boolean(isFromDraftsFolder || userMeta.draft)

  const navLabel =
    !isDraft && typeof userMeta.nav === 'string' && userMeta.nav.trim()
      ? userMeta.nav.trim()
      : !isDraft && userMeta.nav === true
        ? userMeta.title || doc.title
        : undefined

  const excludeFromPosts =
    isDraft ||
    (userMeta.excludeFromPosts !== undefined
      ? Boolean(userMeta.excludeFromPosts)
      : userMeta.unlisted !== undefined
        ? Boolean(userMeta.unlisted)
        : false)

  const frontmatter: Record<string, any> = {
    title: userMeta.title || doc.title,
    date,
    ...(updated ? { updated } : {}),
    description,
    author: userMeta.author || doc.createdBy?.name || defaultAuthor,
    ...(icon ? { icon } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    featured: !isDraft && Boolean(userMeta.featured),
    ...(isDraft
      ? {
          draft: true,
          head: [['meta', { name: 'robots', content: 'noindex, nofollow' }]],
        }
      : {}),
    ...(navLabel ? { nav: navLabel, navOrder: Number(userMeta.navOrder ?? 50) } : {}),
    ...(excludeFromPosts ? { excludeFromPosts: true } : {}),
    outlineId: doc.id,
    outlineUrlId: doc.urlId,
    sidebar: false,
    outline: [2, 3],
  }

  return { slug, frontmatter, body }
}

export function isListed(post: SyncedPost): boolean {
  return !post.frontmatter.excludeFromPosts && !post.frontmatter.draft
}

/** Serializes a post into the Markdown file written to `content/posts/<slug>.md`, escaping text VitePress would otherwise treat as HTML or Vue. */
export function serializePost(post: SyncedPost): string {
  return `---\n${YAML.stringify(post.frontmatter).trim()}\n---\n\n${escapeOutlineText(post.body)}\n`
}
