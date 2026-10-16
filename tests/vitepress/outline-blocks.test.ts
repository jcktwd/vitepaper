import { createMarkdownRenderer, type MarkdownRenderer } from 'vitepress'
import { beforeAll, describe, expect, it } from 'vitest'
import { configureMarkdown } from '../../content/.vitepress/lib/markdown/index.ts'
import { transformToggleBlocks } from '../../content/.vitepress/lib/markdown/outline-blocks.ts'

describe('transformToggleBlocks', () => {
  it('turns a toggle into a details container titled by its head paragraph', () => {
    expect(transformToggleBlocks('+++\nClick me\n\nHidden body\n+++\n')).toBe(':::: details Click me\n\nHidden body\n::::\n')
  })

  it('uses a heading head as the summary', () => {
    expect(transformToggleBlocks('+++\n### Setup steps\n\nBody\n+++')).toBe(':::: details Setup steps\n\nBody\n::::')
  })

  it('joins a multi-line head paragraph', () => {
    expect(transformToggleBlocks('+++\nLine one\nline two\n\nBody\n+++')).toBe(':::: details Line one line two\n\nBody\n::::')
  })

  it('keeps nesting by giving outer toggles longer fences', () => {
    const src = ['++++', 'Outer', '', '+++', 'Inner', '', 'Deep', '+++', '++++'].join('\n')
    expect(transformToggleBlocks(src)).toBe(
      ['::::: details Outer', '', ':::: details Inner', '', 'Deep', '::::', ':::::'].join('\n')
    )
  })

  it('falls back to the default title when the toggle starts with a non-paragraph block', () => {
    expect(transformToggleBlocks('+++\n```sh\nls\n```\n+++')).toBe(':::: details\n```sh\nls\n```\n::::')
  })

  it('ignores markers inside fenced code and unpaired markers', () => {
    const fenced = '```\n+++\nnot a toggle\n+++\n```'
    expect(transformToggleBlocks(fenced)).toBe(fenced)
    expect(transformToggleBlocks('+++\njust text')).toBe('+++\njust text')
  })
})

describe('Outline blocks rendered through VitePress', () => {
  let md: MarkdownRenderer
  beforeAll(async () => {
    md = await createMarkdownRenderer(process.cwd(), { config: configureMarkdown })
  })

  it('renders toggles as <details> with notices nested inside', () => {
    const html = md.render('+++\nMore info\n\n:::info\nInside\n:::\n\nAfter the notice\n+++\n')
    expect(html).toMatch(/^<details class="details custom-block"><summary>More info<\/summary>/)
    expect(html).toContain('<div class="info custom-block">')
    expect(html).toContain('<p>After the notice</p>\n</details>')
  })

  it('renders :::success as a success custom block', () => {
    const html = md.render(':::success\nIt **worked**\n:::\n')
    expect(html).toBe(
      '<div class="success custom-block"><p class="custom-block-title">SUCCESS</p>\n<p>It <strong>worked</strong></p>\n</div>\n'
    )
  })
})
