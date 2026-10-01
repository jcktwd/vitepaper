import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import config from '../vitepaper.config.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const POSTS_DIR = path.join(ROOT_DIR, 'content', 'posts')
const ATTACHMENTS_DIR = path.join(ROOT_DIR, 'content', 'public', 'attachments')

interface OutlineDocNode {
  id: string
  title: string
  url: string
  children: OutlineDocNode[]
}

interface OutlineDocument {
  id: string
  urlId: string
  title: string
  text: string
  icon?: string | null
  emoji?: string | null
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
  createdBy?: { name: string }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

function normalizeOutlineIcon(icon?: string | null): string | undefined {
  if (!icon) return undefined
  const trimmed = icon.trim()
  if (OUTLINE_ICON_MAP[trimmed]) return OUTLINE_ICON_MAP[trimmed]
  if (/^[\x20-\x7E]+$/.test(trimmed)) return undefined
  return trimmed
}

async function outlineRpc<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const apiKey = process.env.OUTLINE_API_KEY
  if (!apiKey) {
    throw new Error('Missing OUTLINE_API_KEY environment variable. Set it in .env or environment.')
  }

  const baseUrl = config.outline.url.replace(/\/+$/, '')
  const res = await fetch(`${baseUrl}/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Outline API ${method} failed (${res.status}): ${errText}`)
  }

  const json = (await res.json()) as { data: T }
  return json.data
}

async function resolveCollectionId(nameOrId: string): Promise<string> {
  if (UUID_RE.test(nameOrId)) return nameOrId

  const collections = await outlineRpc<Array<{ id: string; name: string }>>('collections.list', {
    limit: 100,
  })
  const match = collections.find((c) => c.name.toLowerCase() === nameOrId.toLowerCase())
  if (!match) {
    const available = collections.map((c) => `"${c.name}"`).join(', ')
    throw new Error(`Collection "${nameOrId}" not found in Outline. Available: ${available}`)
  }
  return match.id
}

function findFolderNode(nodes: OutlineDocNode[], nameOrId: string): OutlineDocNode | null {
  const targetLower = nameOrId.toLowerCase()
  for (const node of nodes) {
    if (node.id.toLowerCase() === targetLower || node.title.trim().toLowerCase() === targetLower) {
      return node
    }
    const foundInChild = findFolderNode(node.children || [], nameOrId)
    if (foundInChild) return foundInChild
  }
  return null
}

function collectPostNodes(
  nodes: OutlineDocNode[],
  inheritedTags: string[] = []
): Array<{ id: string; inheritedTags: string[] }> {
  const result: Array<{ id: string; inheritedTags: string[] }> = []
  for (const node of nodes) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    result.push({ id: node.id, inheritedTags })
    if (hasChildren) {
      const folderTag = slugify(node.title)
      const nextTags = folderTag ? [...new Set([...inheritedTags, folderTag])] : inheritedTags
      result.push(...collectPostNodes(node.children, nextTags))
    }
  }
  return result
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

async function downloadAttachment(attachmentId: string): Promise<string> {
  await fs.mkdir(ATTACHMENTS_DIR, { recursive: true })

  const existingFiles = await fs.readdir(ATTACHMENTS_DIR)
  const cached = existingFiles.find((f) => f.startsWith(`${attachmentId}.`))
  if (cached) {
    return `/attachments/${cached}`
  }

  const apiKey = process.env.OUTLINE_API_KEY!
  const baseUrl = config.outline.url.replace(/\/+$/, '')
  const res = await fetch(`${baseUrl}/api/attachments.redirect?id=${attachmentId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    redirect: 'follow',
  })

  if (!res.ok) {
    console.warn(`  [warn] Failed to download attachment ${attachmentId} (${res.status})`)
    return `/api/attachments.redirect?id=${attachmentId}`
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const disposition = res.headers.get('content-disposition') || ''
  const dispExtMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?[^"';\r\n]+\.([a-z0-9]{2,5})["']?/i)
  const urlExtMatch = new URL(res.url).pathname.match(/\.([a-z0-9]{2,5})$/i)

  const ext =
    MIME_EXT[contentType] ||
    (dispExtMatch ? dispExtMatch[1].toLowerCase() : '') ||
    (urlExtMatch ? urlExtMatch[1].toLowerCase() : '') ||
    'bin'

  const filename = `${attachmentId}.${ext}`
  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(path.join(ATTACHMENTS_DIR, filename), buffer)
  console.log(`  + Cached attachment: ${filename} (${(buffer.byteLength / 1024).toFixed(1)} KB)`)

  return `/attachments/${filename}`
}

async function rewriteAttachments(markdown: string): Promise<string> {
  const regex = /\/api\/attachments\.redirect\?id=([0-9a-f-]{36})/gi
  const matches = [...markdown.matchAll(regex)]
  if (matches.length === 0) return markdown

  const uniqueIds = [...new Set(matches.map((m) => m[1]))]
  const idToLocalPath = new Map<string, string>()

  for (const id of uniqueIds) {
    const localPath = await downloadAttachment(id)
    idToLocalPath.set(id, localPath)
  }

  return markdown.replace(regex, (full, id: string) => idToLocalPath.get(id) || full)
}

export interface SyncedPost {
  slug: string
  frontmatter: Record<string, any>
  body: string
}

export function parseDocumentFrontmatter(
  rawMarkdown: string,
  doc: OutlineDocument,
  inheritedTags: string[],
  isFromDraftsFolder = false
): SyncedPost {
  let body = rawMarkdown.replace(/\r\n/g, '\n').trim()
  let userMeta: Record<string, any> = {}

  // 1. Extract optional top-of-doc ```yaml or ```frontmatter code block
  const yamlBlockRe = /^```(?:yaml|yml|frontmatter)\n([\s\S]*?)\n```\s*/i
  const yamlMatch = body.match(yamlBlockRe)
  if (yamlMatch) {
    try {
      const parsed = YAML.parse(yamlMatch[1])
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

  // 3. Extract description from YAML override, first italic subtitle, or first paragraph
  let description: string = userMeta.description || ''
  if (!description) {
    const paragraphs = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith('#') && !p.startsWith(':::') && !p.startsWith('```') && !p.startsWith('!['))

    if (paragraphs.length > 0) {
      description = paragraphs[0]
        .replace(/^[*_]+|[*_]+$/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/@?\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[`*_~]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (description.length > 220) {
        description = description.slice(0, 217).trimEnd() + '...'
      }
    }
  }

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
    author: userMeta.author || doc.createdBy?.name || config.site.author,
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

/**
 * Rewrites internal Outline links (`/doc/...`, `https://<outline>/doc/...`, and `@[Title](mention://...)`)
 * across all synced posts (outside fenced code blocks):
 * - Links to published posts become `/posts/<targetSlug>` and register a backlink on the target post.
 * - Links to private/unsynced Outline notes are gracefully unwrapped to plain text so they never 404.
 */
function resolveCrossDocumentLinksAndBacklinks(posts: SyncedPost[]) {
  const byOutlineId = new Map<string, SyncedPost>()
  const byUrlId = new Map<string, SyncedPost>()

  for (const post of posts) {
    if (post.frontmatter.outlineId) {
      byOutlineId.set(String(post.frontmatter.outlineId).toLowerCase(), post)
    }
    if (post.frontmatter.outlineUrlId) {
      byUrlId.set(String(post.frontmatter.outlineUrlId), post)
    }
  }

  const backlinksMap = new Map<
    string,
    Map<string, { title: string; link: string; icon?: string }>
  >()

  function recordBacklink(source: SyncedPost, target: SyncedPost) {
    if (source.slug === target.slug) return
    // Only record backlinks from public listed posts (never leak drafts or navbar utility pages)
    if (source.frontmatter.draft || source.frontmatter.excludeFromPosts) return

    let targetLinks = backlinksMap.get(target.slug)
    if (!targetLinks) {
      targetLinks = new Map()
      backlinksMap.set(target.slug, targetLinks)
    }
    targetLinks.set(source.slug, {
      title: source.frontmatter.title,
      link: `/posts/${source.slug}`,
      ...(source.frontmatter.icon ? { icon: source.frontmatter.icon } : {}),
    })
  }

  function findTargetDoc(identifier: string): SyncedPost | undefined {
    const clean = identifier.trim()
    if (byOutlineId.has(clean.toLowerCase())) {
      return byOutlineId.get(clean.toLowerCase())
    }
    const trailingUuid = clean.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
    if (trailingUuid && byOutlineId.has(trailingUuid[1].toLowerCase())) {
      return byOutlineId.get(trailingUuid[1].toLowerCase())
    }
    if (byUrlId.has(clean)) {
      return byUrlId.get(clean)
    }
    const suffix = clean.split('-').pop()
    if (suffix && byUrlId.has(suffix)) {
      return byUrlId.get(suffix)
    }
    return undefined
  }

  for (const sourcePost of posts) {
    // Split by fenced code blocks so we never rewrite links inside ```...``` code blocks
    const segments = sourcePost.body.split(/(^```[\s\S]*?^```)/gm)

    for (let i = 0; i < segments.length; i++) {
      if (segments[i].startsWith('```')) continue

      // 1. Rewrite Outline `@[Label](mention://<id>/document/<docUuid>)` mentions
      segments[i] = segments[i].replace(
        /@\[([^\]]+)\]\(mention:\/\/[0-9a-f-]+\/document\/([0-9a-f-]{36})\)/gi,
        (_full, label: string, docUuid: string) => {
          const target = findTargetDoc(docUuid)
          if (target && (!target.frontmatter.draft || sourcePost.frontmatter.draft)) {
            recordBacklink(sourcePost, target)
            return `[${label}](/posts/${target.slug})`
          }
          return label
        }
      )

      // 2. Rewrite `[Label](/doc/<slug-or-id>#anchor)` and `[Label](https://<outline>/doc/<slug-or-id>#anchor)`
      segments[i] = segments[i].replace(
        /(?<!!)\[([^\]]+)\]\((?:https?:\/\/[^)\s/]+)?\/doc\/([a-zA-Z0-9_-]+)(#[a-zA-Z0-9_-]+)?\)/g,
        (_full, label: string, docIdentifier: string, hash: string | undefined) => {
          const target = findTargetDoc(docIdentifier)
          if (target && (!target.frontmatter.draft || sourcePost.frontmatter.draft)) {
            recordBacklink(sourcePost, target)
            return `[${label}](/posts/${target.slug}${hash || ''})`
          }
          return label
        }
      )
    }

    sourcePost.body = segments.join('')
  }

  for (const post of posts) {
    const bl = backlinksMap.get(post.slug)
    if (bl && bl.size > 0) {
      post.frontmatter.backlinks = [...bl.values()]
    }
  }
}

export async function syncOutline(options: { useDrafts?: boolean } = {}) {
  console.log(
    `\n[VitePaper Sync] Connecting to ${config.outline.url} (Collection: "${config.outline.collection}")...`
  )

  const collectionId = await resolveCollectionId(config.outline.collection)
  const tree = await outlineRpc<OutlineDocNode[]>('collections.documents', {
    id: collectionId,
  })

  const publishedNode = findFolderNode(tree, config.outline.publishedFolder)
  const draftsNode = findFolderNode(tree, config.outline.draftsFolder)

  if (!publishedNode && !draftsNode) {
    const topFolders = tree.map((n) => `"${n.title}"`).join(', ')
    console.warn(
      `[VitePaper Sync] Neither "${config.outline.publishedFolder}" nor "${config.outline.draftsFolder}" found in collection "${config.outline.collection}". Top-level documents: ${topFolders || '(none)'}`
    )
    return { syncedCount: 0 }
  }

  const publishedCandidates = publishedNode
    ? collectPostNodes(publishedNode.children || []).map((n) => ({ ...n, isDraft: false }))
    : []
  const draftCandidates = draftsNode
    ? collectPostNodes(draftsNode.children || []).map((n) => ({ ...n, isDraft: true }))
    : []

  const allCandidates = options.useDrafts
    ? draftCandidates
    : [...publishedCandidates, ...draftCandidates]

  console.log(
    `[VitePaper Sync] Found ${publishedCandidates.length} published document(s) and ${draftCandidates.length} draft(s).`
  )

  const posts: SyncedPost[] = []

  for (const item of allCandidates) {
    const doc = await outlineRpc<OutlineDocument>('documents.info', { id: item.id })

    const rawText = (doc.text || '').trim()
    if (!rawText) {
      console.log(`  - Skipping empty container document: "${doc.title}"`)
      continue
    }

    console.log(`  * Processing${item.isDraft ? ' [DRAFT]' : ''}: "${doc.title}"`)
    const textWithAttachments = await rewriteAttachments(rawText)
    const parsed = parseDocumentFrontmatter(textWithAttachments, doc, item.inheritedTags, item.isDraft)
    posts.push(parsed)
  }

  // Sort newest first by date
  posts.sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())

  // Resolve cross-document links (`/doc/...`, `@mentions`) and compute `backlinks`
  resolveCrossDocumentLinksAndBacklinks(posts)

  // Populate chronological prev/next links ONLY for listed blog posts (skipping drafts and excludeFromPosts pages)
  const listedPosts = posts.filter((p) => !p.frontmatter.excludeFromPosts && !p.frontmatter.draft)
  for (let i = 0; i < listedPosts.length; i++) {
    const newer = listedPosts[i - 1]
    const older = listedPosts[i + 1]
    listedPosts[i].frontmatter.prev = newer
      ? { text: newer.frontmatter.title, link: `/posts/${newer.slug}` }
      : false
    listedPosts[i].frontmatter.next = older
      ? { text: older.frontmatter.title, link: `/posts/${older.slug}` }
      : false
  }
  for (const unlisted of posts.filter((p) => p.frontmatter.excludeFromPosts || p.frontmatter.draft)) {
    unlisted.frontmatter.prev = false
    unlisted.frontmatter.next = false
  }

  await fs.mkdir(POSTS_DIR, { recursive: true })
  const activeFilenames = new Set<string>()

  for (const post of posts) {
    const filename = `${post.slug}.md`
    activeFilenames.add(filename)
    const fileContent = `---\n${YAML.stringify(post.frontmatter).trim()}\n---\n\n${post.body}\n`
    await fs.writeFile(path.join(POSTS_DIR, filename), fileContent, 'utf8')
  }

  // Prune any stale .md files in content/posts/ no longer in the target folders
  if (existsSync(POSTS_DIR)) {
    const existing = await fs.readdir(POSTS_DIR)
    for (const file of existing) {
      if (file.endsWith('.md') && !activeFilenames.has(file)) {
        await fs.unlink(path.join(POSTS_DIR, file))
        console.log(`  - Removed unpublished/moved post: ${file}`)
      }
    }
  }

  // Touch config.ts so a running `vitepress dev` server hot-reloads dynamic `nav` items
  const vpConfigPath = path.join(ROOT_DIR, 'content', '.vitepress', 'config.ts')
  if (existsSync(vpConfigPath)) {
    const now = new Date()
    await fs.utimes(vpConfigPath, now, now).catch(() => {})
  }

  console.log(`[VitePaper Sync] Successfully synced ${posts.length} document(s) to content/posts/.\n`)
  return { syncedCount: posts.length, slugs: posts.map((p) => p.slug) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const useDrafts = process.argv.includes('--drafts')
  syncOutline({ useDrafts }).catch((err) => {
    console.error('[VitePaper Sync Error]', err.message || err)
    process.exit(1)
  })
}
