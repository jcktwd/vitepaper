import { describe, expect, it } from 'vitest'
import type { SyncedPost } from '../../scripts/sync/frontmatter.ts'
import { assignPrevNext, resolveCrossDocumentLinksAndBacklinks } from '../../scripts/sync/links.ts'

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ID_DRAFT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const ID_PRIVATE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function post(slug: string, outlineId: string, urlId: string, body: string, extra: Record<string, unknown> = {}): SyncedPost {
  return { slug, body, frontmatter: { title: slug.toUpperCase(), outlineId, outlineUrlId: urlId, ...extra } }
}

describe('resolveCrossDocumentLinksAndBacklinks', () => {
  it('rewrites /doc links, full Outline URLs and @mentions to published posts, and records backlinks', () => {
    const a = post(
      'post-a',
      ID_A,
      'urlA',
      [
        'See [B](/doc/post-b-urlB#setup).',
        'Also [B again](https://outline.example.com/doc/urlB).',
        `And @[B mention](mention://${ID_PRIVATE}/document/${ID_B}).`,
      ].join('\n')
    )
    const b = post('post-b', ID_B, 'urlB', 'Body B.')

    resolveCrossDocumentLinksAndBacklinks([a, b])

    expect(a.body).toBe(
      ['See [B](/posts/post-b#setup).', 'Also [B again](/posts/post-b).', 'And [B mention](/posts/post-b).'].join('\n')
    )
    expect(b.frontmatter.backlinks).toEqual([{ title: 'POST-A', link: '/posts/post-a' }])
    expect(a.frontmatter).not.toHaveProperty('backlinks')
  })

  it('unwraps links to private (unsynced) documents to plain text', () => {
    const a = post('post-a', ID_A, 'urlA', `[Secret](/doc/secret-xyz123) and @[Hidden](mention://${ID_B}/document/${ID_PRIVATE})`)
    resolveCrossDocumentLinksAndBacklinks([a])
    expect(a.body).toBe('Secret and Hidden')
  })

  it('never links published posts to drafts, but lets drafts link anywhere', () => {
    const published = post('pub', ID_A, 'urlA', '[Draft](/doc/urlD)')
    const draft = post('draft', ID_DRAFT, 'urlD', '[Pub](/doc/urlA)', { draft: true })

    resolveCrossDocumentLinksAndBacklinks([published, draft])

    expect(published.body).toBe('Draft')
    expect(draft.body).toBe('[Pub](/posts/pub)')
    // Drafts never leak into backlinks
    expect(published.frontmatter).not.toHaveProperty('backlinks')
  })

  it('leaves links inside fenced code blocks and images untouched', () => {
    const body = '```md\n[B](/doc/urlB)\n```\n![diagram](/doc/urlB)'
    const a = post('a', ID_A, 'urlA', body)
    resolveCrossDocumentLinksAndBacklinks([a, post('b', ID_B, 'urlB', '')])
    expect(a.body).toBe(body)
  })
})

describe('assignPrevNext', () => {
  it('links listed posts chronologically (newest first) and disables nav on unlisted pages', () => {
    const newest = post('newest', ID_A, 'u1', '')
    const about = post('about', ID_B, 'u2', '', { excludeFromPosts: true })
    const oldest = post('oldest', ID_DRAFT, 'u3', '')

    assignPrevNext([newest, about, oldest])

    expect(newest.frontmatter.prev).toBe(false)
    expect(newest.frontmatter.next).toEqual({ text: 'OLDEST', link: '/posts/oldest' })
    expect(oldest.frontmatter.prev).toEqual({ text: 'NEWEST', link: '/posts/newest' })
    expect(oldest.frontmatter.next).toBe(false)
    expect(about.frontmatter).toMatchObject({ prev: false, next: false })
  })
})
