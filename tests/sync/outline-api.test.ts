import { describe, expect, it } from 'vitest'
import { attachmentExtension, rewriteAttachments } from '../../scripts/sync/attachments.ts'
import { collectPostNodes, findFolderNode, type OutlineDocNode } from '../../scripts/sync/outline-api.ts'

function node(id: string, title: string, children: OutlineDocNode[] = []): OutlineDocNode {
  return { id, title, url: `/doc/${id}`, children }
}

const tree = [
  node('root-published', 'Published', [
    node('p1', 'First Post'),
    node('folder', 'Home Lab', [node('p2', 'Nested Post', [node('p3', 'Deep Post')])]),
  ]),
  node('root-drafts', ' Drafts '),
]

describe('findFolderNode', () => {
  it('matches by trimmed, case-insensitive title or by id, at any depth', () => {
    expect(findFolderNode(tree, 'published')?.id).toBe('root-published')
    expect(findFolderNode(tree, 'DRAFTS')?.id).toBe('root-drafts')
    expect(findFolderNode(tree, 'p2')?.title).toBe('Nested Post')
    expect(findFolderNode(tree, 'missing')).toBeNull()
  })
})

describe('collectPostNodes', () => {
  it('includes every document and passes folder titles down as tags', () => {
    expect(collectPostNodes(tree[0].children)).toEqual([
      { id: 'p1', inheritedTags: [] },
      { id: 'folder', inheritedTags: [] },
      { id: 'p2', inheritedTags: ['home-lab'] },
      { id: 'p3', inheritedTags: ['home-lab', 'nested-post'] },
    ])
  })
})

describe('attachmentExtension', () => {
  it('prefers Content-Type, then Content-Disposition, then the URL, then .bin', () => {
    expect(attachmentExtension('image/webp; charset=binary', 'filename="x.png"', 'https://s3/x.jpg')).toBe('webp')
    expect(attachmentExtension('application/octet-stream', "attachment; filename*=UTF-8''diagram.SVG", 'https://s3/x')).toBe('svg')
    expect(attachmentExtension('', '', 'https://s3/bucket/file.tar.gz?sig=1')).toBe('gz')
    expect(attachmentExtension('', '', 'https://s3/bucket/file')).toBe('bin')
  })
})

describe('rewriteAttachments', () => {
  it('resolves each unique attachment once and rewrites every occurrence', async () => {
    const id = '12345678-1234-4234-8234-123456789abc'
    const md = `![a](/api/attachments.redirect?id=${id}) and [file](/api/attachments.redirect?id=${id})`
    const calls: string[] = []

    const out = await rewriteAttachments(md, async (attachmentId) => {
      calls.push(attachmentId)
      return `/attachments/${attachmentId}.png`
    })

    expect(calls).toEqual([id])
    expect(out).toBe(`![a](/attachments/${id}.png) and [file](/attachments/${id}.png)`)
  })

  it('returns markdown unchanged when there are no attachments', async () => {
    expect(await rewriteAttachments('plain', async () => 'never')).toBe('plain')
  })
})
