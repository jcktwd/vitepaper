import { describe, expect, it } from 'vitest'
import { parseDocumentFrontmatter } from '../../scripts/sync/frontmatter.ts'
import type { OutlineDocument } from '../../scripts/sync/outline-api.ts'

const doc: OutlineDocument = {
  id: '11111111-1111-4111-8111-111111111111',
  urlId: 'AbCdEf1234',
  title: 'Hello World',
  text: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  publishedAt: '2026-01-03T00:00:00.000Z',
}

describe('metadata inside an Outline toggle block', () => {
  it.each([
    ['paragraph head', '+++\nMetadata\n\n```yaml\ntags: [linux]\nfeatured: true\n```\n+++\n\nBody text.'],
    ['heading head', '+++\n### Frontmatter\n```yml\ntags: [linux]\nfeatured: true\n```\n+++\nBody text.'],
    // Exactly how Outline exports a top-level toggle: five pluses and blank lines around the code
    ['Outline export', '+++++\nMetadata\n\n```yaml\ntags: [linux]\nfeatured: true\n```\n\n+++++\nBody text.'],
  ])('reads YAML from a toggle with a %s and strips the toggle', (_label, md) => {
    const post = parseDocumentFrontmatter(md, doc, [])
    expect(post.frontmatter.tags).toEqual(['linux'])
    expect(post.frontmatter.featured).toBe(true)
    expect(post.body).toBe('Body text.')
    expect(post.frontmatter.description).toBe('Body text.')
  })

  it('leaves other toggles at the top of a document alone', () => {
    const md = '+++\nSpoilers\n\n```yaml\nkey: value\n```\n+++\n\nBody.'
    const post = parseDocumentFrontmatter(md, doc, [])
    expect(post.body).toBe(md)
    expect(post.frontmatter.tags).toBeUndefined()
  })
})
