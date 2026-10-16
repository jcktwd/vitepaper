import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../vitepaper.config.ts'
import { downloadAttachment, rewriteAttachments } from './sync/attachments.ts'
import { parseDocumentFrontmatter, serializePost, type SyncedPost } from './sync/frontmatter.ts'
import { assignPrevNext, resolveCrossDocumentLinksAndBacklinks } from './sync/links.ts'
import {
  collectPostNodes,
  createOutlineClient,
  findFolderNode,
  resolveCollectionId,
  type OutlineDocNode,
  type OutlineDocument,
} from './sync/outline-api.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const POSTS_DIR = path.join(ROOT_DIR, 'content', 'posts')
const ATTACHMENTS_DIR = path.join(ROOT_DIR, 'content', 'public', 'attachments')

export async function syncOutline(options: { useDrafts?: boolean } = {}) {
  console.log(
    `\n[VitePaper Sync] Connecting to ${config.outline.url} (Collection: "${config.outline.collection}")...`
  )

  const client = createOutlineClient(config.outline.url, process.env.OUTLINE_API_KEY)
  const collectionId = await resolveCollectionId(client, config.outline.collection)
  const tree = await client.rpc<OutlineDocNode[]>('collections.documents', {
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
    const doc = await client.rpc<OutlineDocument>('documents.info', { id: item.id })

    const rawText = (doc.text || '').trim()
    if (!rawText) {
      console.log(`  - Skipping empty container document: "${doc.title}"`)
      continue
    }

    console.log(`  * Processing${item.isDraft ? ' [DRAFT]' : ''}: "${doc.title}"`)
    const textWithAttachments = await rewriteAttachments(rawText, (id) =>
      downloadAttachment(client, ATTACHMENTS_DIR, id)
    )
    posts.push(
      parseDocumentFrontmatter(textWithAttachments, doc, item.inheritedTags, {
        isDraft: item.isDraft,
        defaultAuthor: config.site.author,
      })
    )
  }

  // Sort newest first by date
  posts.sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())

  // Resolve cross-document links (`/doc/...`, `@mentions`), compute `backlinks` and prev/next
  resolveCrossDocumentLinksAndBacklinks(posts)
  assignPrevNext(posts)

  await writePosts(posts)

  // Touch config.ts so a running `vitepress dev` server hot-reloads dynamic `nav` items
  const vpConfigPath = path.join(ROOT_DIR, 'content', '.vitepress', 'config.ts')
  if (existsSync(vpConfigPath)) {
    const now = new Date()
    await fs.utimes(vpConfigPath, now, now).catch(() => {})
  }

  console.log(`[VitePaper Sync] Successfully synced ${posts.length} document(s) to content/posts/.\n`)
  return { syncedCount: posts.length, slugs: posts.map((p) => p.slug) }
}

/** Writes each post to `content/posts/<slug>.md` and prunes files for posts no longer synced. */
async function writePosts(posts: SyncedPost[]) {
  await fs.mkdir(POSTS_DIR, { recursive: true })
  const activeFilenames = new Set<string>()

  for (const post of posts) {
    const filename = `${post.slug}.md`
    activeFilenames.add(filename)
    await fs.writeFile(path.join(POSTS_DIR, filename), serializePost(post), 'utf8')
  }

  for (const file of await fs.readdir(POSTS_DIR)) {
    if (file.endsWith('.md') && !activeFilenames.has(file)) {
      await fs.unlink(path.join(POSTS_DIR, file))
      console.log(`  - Removed unpublished/moved post: ${file}`)
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const useDrafts = process.argv.includes('--drafts')
  syncOutline({ useDrafts }).catch((err) => {
    console.error('[VitePaper Sync Error]', err.message || err)
    process.exit(1)
  })
}
