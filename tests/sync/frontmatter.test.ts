import { describe, expect, it } from 'vitest'
import { deriveDescription, normalizeOutlineIcon, parseDocumentFrontmatter, serializePost } from '../../scripts/sync/frontmatter.ts'
import type { OutlineDocument } from '../../scripts/sync/outline-api.ts'
import { slugify } from '../../scripts/sync/slugify.ts'

function doc(overrides: Partial<OutlineDocument> = {}): OutlineDocument {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    urlId: 'AbCdEf1234',
    title: 'Hello World',
    text: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    publishedAt: '2026-01-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('slugify', () => {
  it('lowercases, strips accents and collapses punctuation', () => {
    expect(slugify('  Héllo, Wörld!  ')).toBe('hello-world')
    expect(slugify("HP's Embedded Fan-Controller")).toBe('hp-s-embedded-fan-controller')
  })

  it('returns an empty string for symbol-only input', () => {
    expect(slugify('🚀!!')).toBe('')
  })
})

describe('normalizeOutlineIcon', () => {
  it('maps named Outline icons to emoji', () => {
    expect(normalizeOutlineIcon('rocket')).toBe('🚀')
  })

  it('drops unknown ASCII icon names and keeps real emoji', () => {
    expect(normalizeOutlineIcon('some-unknown-icon')).toBeUndefined()
    expect(normalizeOutlineIcon('🦀')).toBe('🦀')
    expect(normalizeOutlineIcon(null)).toBeUndefined()
  })
})

describe('deriveDescription', () => {
  it('uses the first prose paragraph, skipping headings, callouts, code and images', () => {
    const body = '# Title\n\n:::tip\nhi\n:::\n\n![img](/a.png)\n\nThe **first** [real](/x) paragraph.\n\nSecond.'
    expect(deriveDescription(body)).toBe('The first real paragraph.')
  })

  it('drops footnote markers and skips footnote definitions and lone video links', () => {
    expect(deriveDescription('Runs at 32 kHz.[^1] Fast.\n\n[^1]: Measured.')).toBe('Runs at 32 kHz. Fast.')
    expect(deriveDescription('[^1]: Measured.\n\n[Demo 1280x720](/attachments/a.mp4)\n\nReal intro.')).toBe('Real intro.')
    // A lone ordinary link whose label happens to end in "x" is still prose
    expect(deriveDescription('[Index](/posts/index)')).toBe('Index')
  })

  it('truncates long paragraphs to 220 characters', () => {
    const description = deriveDescription('word '.repeat(100))
    expect(description.length).toBeLessThanOrEqual(220)
    expect(description.endsWith('...')).toBe(true)
  })
})

describe('parseDocumentFrontmatter', () => {
  it('extracts and strips the top-of-doc YAML block', () => {
    const md = '```yaml\ntitle: Custom\nslug: custom-slug\ntags: [Hardware, linux]\nfeatured: true\n```\n\nBody text.'
    const post = parseDocumentFrontmatter(md, doc(), [])

    expect(post.slug).toBe('custom-slug')
    expect(post.body).toBe('Body text.')
    expect(post.frontmatter).toMatchObject({
      title: 'Custom',
      tags: ['hardware', 'linux'],
      featured: true,
      description: 'Body text.',
      outlineId: doc().id,
      outlineUrlId: doc().urlId,
    })
  })

  it('merges inherited folder tags, inline `Tags:` line and YAML tags without duplicates', () => {
    const md = '```yaml\ntags: linux, homelab\n```\nTags: #homelab #networking\n\nBody.'
    const post = parseDocumentFrontmatter(md, doc(), ['homelab'])
    expect(post.frontmatter.tags).toEqual(['homelab', 'networking', 'linux'])
    expect(post.body).toBe('Body.')
  })

  it('defaults date to publishedAt and only sets `updated` when given in YAML', () => {
    expect(parseDocumentFrontmatter('Body.', doc(), []).frontmatter).not.toHaveProperty('updated')
    expect(parseDocumentFrontmatter('Body.', doc(), []).frontmatter.date).toBe('2026-01-03T00:00:00.000Z')

    const post = parseDocumentFrontmatter('```yaml\ndate: 2025-05-05\nupdated: 2025-06-06\n```\nBody.', doc(), [])
    expect(post.frontmatter.date).toBe('2025-05-05T00:00:00.000Z')
    expect(post.frontmatter.updated).toBe('2025-06-06T00:00:00.000Z')
  })

  it('falls back to the Outline urlId when the title has no sluggable characters', () => {
    expect(parseDocumentFrontmatter('Body.', doc({ title: '🚀' }), []).slug).toBe('abcdef1234')
  })

  it('marks drafts noindex, unlisted, unfeatured and never pinned to the navbar', () => {
    const md = '```yaml\nfeatured: true\nnav: About\n```\nBody.'
    const { frontmatter } = parseDocumentFrontmatter(md, doc(), [], { isDraft: true })
    expect(frontmatter).toMatchObject({ draft: true, excludeFromPosts: true, featured: false })
    expect(frontmatter.head).toEqual([['meta', { name: 'robots', content: 'noindex, nofollow' }]])
    expect(frontmatter).not.toHaveProperty('nav')
  })

  it('supports `nav` pinning with order and `excludeFromPosts` / `unlisted`', () => {
    const pinned = parseDocumentFrontmatter('```yaml\nnav: About Me\nnavOrder: 10\nexcludeFromPosts: true\n```\nx', doc(), [])
    expect(pinned.frontmatter).toMatchObject({ nav: 'About Me', navOrder: 10, excludeFromPosts: true })

    const navTrue = parseDocumentFrontmatter('```yaml\nnav: true\nunlisted: true\n```\nx', doc(), [])
    expect(navTrue.frontmatter).toMatchObject({ nav: 'Hello World', navOrder: 50, excludeFromPosts: true })
  })

  it('resolves author from YAML, then Outline, then the configured default', () => {
    expect(parseDocumentFrontmatter('```yaml\nauthor: Ada\n```\nx', doc(), []).frontmatter.author).toBe('Ada')
    expect(parseDocumentFrontmatter('x', doc({ createdBy: { name: 'Grace' } }), []).frontmatter.author).toBe('Grace')
    expect(parseDocumentFrontmatter('x', doc(), [], { defaultAuthor: 'Site' }).frontmatter.author).toBe('Site')
  })
})

describe('serializePost', () => {
  it('writes YAML frontmatter followed by the body', () => {
    const out = serializePost({ slug: 'a', frontmatter: { title: 'A', tags: ['x'] }, body: 'Body.' })
    expect(out).toBe('---\ntitle: A\ntags:\n  - x\n---\n\nBody.\n')
  })
})
