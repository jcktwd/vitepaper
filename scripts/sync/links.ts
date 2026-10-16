import { isListed, type SyncedPost } from './frontmatter.ts'

interface Backlink {
  title: string
  link: string
  icon?: string
}

/**
 * Rewrites internal Outline links (`/doc/...`, `https://<outline>/doc/...`, and `@[Title](mention://...)`)
 * across all synced posts (outside fenced code blocks), mutating each post's `body`:
 * - Links to published posts become `/posts/<targetSlug>` and register a backlink on the target post.
 * - Links to private/unsynced Outline notes are gracefully unwrapped to plain text so they never 404.
 * Targets receive `frontmatter.backlinks` listing the public posts that link to them.
 */
export function resolveCrossDocumentLinksAndBacklinks(posts: SyncedPost[]): void {
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

  const backlinksMap = new Map<string, Map<string, Backlink>>()

  function recordBacklink(source: SyncedPost, target: SyncedPost) {
    if (source.slug === target.slug) return
    // Only record backlinks from public listed posts (never leak drafts or navbar utility pages)
    if (!isListed(source)) return

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

  /** Drafts may link to anything; published posts may only link to other published posts. */
  function linkTarget(source: SyncedPost, identifier: string): SyncedPost | undefined {
    const target = findTargetDoc(identifier)
    if (target && (!target.frontmatter.draft || source.frontmatter.draft)) {
      recordBacklink(source, target)
      return target
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
          const target = linkTarget(sourcePost, docUuid)
          return target ? `[${label}](/posts/${target.slug})` : label
        }
      )

      // 2. Rewrite `[Label](/doc/<slug-or-id>#anchor)` and `[Label](https://<outline>/doc/<slug-or-id>#anchor)`
      segments[i] = segments[i].replace(
        /(?<!!)\[([^\]]+)\]\((?:https?:\/\/[^)\s/]+)?\/doc\/([a-zA-Z0-9_-]+)(#[a-zA-Z0-9_-]+)?\)/g,
        (_full, label: string, docIdentifier: string, hash: string | undefined) => {
          const target = linkTarget(sourcePost, docIdentifier)
          return target ? `[${label}](/posts/${target.slug}${hash || ''})` : label
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

/**
 * Sets chronological `prev`/`next` frontmatter on listed posts (expects `posts` sorted newest first);
 * drafts and unlisted pages get `prev: false` / `next: false`.
 */
export function assignPrevNext(posts: SyncedPost[]): void {
  const listedPosts = posts.filter(isListed)
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
  for (const unlisted of posts.filter((p) => !isListed(p))) {
    unlisted.frontmatter.prev = false
    unlisted.frontmatter.next = false
  }
}
