import { describe, expect, it } from 'vitest'
import { extractCodeBlockTabMeta, transformCodeTabs } from '../../content/.vitepress/lib/markdown/code-tabs.ts'
import { applySingleAxisSize } from '../../content/.vitepress/lib/markdown/images.ts'
import { renderInlineToken } from '../../content/.vitepress/lib/markdown/inline-tokens.ts'
import { normalizeOutlineMarkdown } from '../../content/.vitepress/lib/markdown/outline-fixes.ts'

describe('normalizeOutlineMarkdown', () => {
  it('fixes Outline bold + inline code serialization quirks', () => {
    expect(normalizeOutlineMarkdown('**`**code**`**')).toBe('`code`')
    expect(normalizeOutlineMarkdown('`**code**`')).toBe('**`code`**')
  })

  it('converts resized image titles to img-size syntax', () => {
    expect(normalizeOutlineMarkdown('![Alt](/a.png " =360x240")')).toBe('![Alt](/a.png =360x240)')
    expect(normalizeOutlineMarkdown('![Alt](/a.png " full-width =50%x")')).toBe('![Alt](/a.png =50%x)')
  })

  it('leaves ordinary image titles alone', () => {
    expect(normalizeOutlineMarkdown('![Alt](/a.png "A title")')).toBe('![Alt](/a.png "A title")')
  })
})

describe('extractCodeBlockTabMeta', () => {
  it.each([
    ['multi-line YAML', '---\ntab-group: req\ntab: Headers\n---\nGET /\n'],
    ['single-line YAML', '--- tab-group: req, tab: Headers ---\nGET /\n'],
    ['bracketed, one line', '[tab-group: req, tab: Headers]\nGET /\n'],
    ['bracketed, two groups', '[tab-group: req] [tab: Headers]\nGET /\n'],
    ['bracketed, two lines', '[tab-group: req]\n[tab: Headers]\nGET /\n'],
  ])('reads %s', (_label, body) => {
    expect(extractCodeBlockTabMeta(body)).toEqual({ body: 'GET /\n', tab: 'Headers', group: 'req' })
  })

  it('ignores code that merely starts with brackets or YAML', () => {
    for (const body of ['[1, 2, 3]\n', '[section]\nkey=value\n', '---\ntitle: x\n---\n']) {
      expect(extractCodeBlockTabMeta(body)).toEqual({ body })
    }
  })
})

describe('transformCodeTabs', () => {
  it('groups consecutive tabbed fences into a code-group', () => {
    const src = '```http\n[tab: Request]\nGET /\n```\n\n```json\n[tab: Response]\n{}\n```\n'
    expect(transformCodeTabs(src)).toBe(
      '::: code-group\n\n```http [Request]\nGET /\n```\n\n```json [Response]\n{}\n```\n\n:::\n'
    )
  })

  it('splits back-to-back named groups and leaves untabbed fences alone', () => {
    const src = [
      '```sh\n[tab-group: a, tab: One]\nx\n```',
      '```sh\n[tab-group: b, tab: Two]\ny\n```',
      '```sh\nplain\n```',
      '',
    ].join('\n')
    const out = transformCodeTabs(src)
    expect(out.match(/::: code-group/g)).toHaveLength(2)
    expect(out).toContain('```sh\nplain\n```')
  })

  it('does not touch runs without tab metadata', () => {
    const src = '```js\na\n```\n```js\nb\n```\n'
    expect(transformCodeTabs(src)).toBe(src)
  })
})

describe('renderInlineToken', () => {
  it('renders the socials integration', () => {
    expect(renderInlineToken('integration: socials')).toBe('<SocialLinks />')
    expect(renderInlineToken(' VitePaper:socials ')).toBe('<SocialLinks />')
  })

  it('renders brand, shorthand and collection icons', () => {
    expect(renderInlineToken('icon:github')).toContain("url('https://api.iconify.design/simple-icons/github.svg')")
    expect(renderInlineToken('icon:vue')).toContain('simple-icons/vuedotjs.svg')
    expect(renderInlineToken('icon:lucide:cpu')).toContain('lucide/cpu.svg')
  })

  it('renders multicolor icon sets as <img>', () => {
    expect(renderInlineToken('icon:logos:docker')).toMatch(/^<img class="vp-inline-icon-img"/)
  })

  it('returns null for ordinary inline code', () => {
    expect(renderInlineToken('const x = 1')).toBeNull()
    expect(renderInlineToken('icon: github')).toBeNull()
  })
})

describe('applySingleAxisSize', () => {
  const html = '<NolebaseUnlazyImg autoSizes="true" width="1200" height="800" />'

  it('scales height proportionally from an explicit width', () => {
    expect(applySingleAxisSize(html, '300', null)).toBe(
      '<NolebaseUnlazyImg autoSizes="false" width="300" height="200" />'
    )
  })

  it('scales width proportionally from an explicit height', () => {
    expect(applySingleAxisSize(html, null, '400')).toBe(
      '<NolebaseUnlazyImg autoSizes="false" width="600" height="400" />'
    )
  })

  it('leaves the HTML alone when both, neither or invalid dimensions are given', () => {
    expect(applySingleAxisSize(html, '300', '300')).toBe(html)
    expect(applySingleAxisSize(html, null, null)).toBe(html)
    expect(applySingleAxisSize(html, '50%', null)).toBe(html)
    expect(applySingleAxisSize('<img src="x">', '300', null)).toBe('<img src="x">')
  })
})
