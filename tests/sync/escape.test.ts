import path from 'node:path'
import { createMarkdownRenderer, type MarkdownRenderer } from 'vitepress'
import { compileTemplate } from 'vue/compiler-sfc'
import { beforeAll, describe, expect, it } from 'vitest'
import { configureMarkdown } from '../../content/.vitepress/lib/markdown/index.ts'
import { escapeOutlineText } from '../../scripts/sync/escape.ts'

describe('escapeOutlineText', () => {
  it('escapes < and {{ in prose', () => {
    expect(escapeOutlineText('A Vec<String> holds {{ name }}.')).toBe('A Vec&lt;String> holds &#123;&#123; name }}.')
  })

  it('keeps the <br> and autolinks Outline emits itself', () => {
    expect(escapeOutlineText('| a<br>b | <br/> |')).toBe('| a<br>b | <br/> |')
    expect(escapeOutlineText('See <https://example.com/a?b=1> or <me@example.com>.')).toBe(
      'See <https://example.com/a?b=1> or <me@example.com>.'
    )
  })

  it('leaves fenced code, $$ blocks, inline code and inline math alone', () => {
    const src = [
      '```rust',
      'let v: Vec<String> = {{ }};',
      '```',
      '~~~~',
      '<div>',
      '~~~~',
      '$$',
      'a < b',
      '$$',
      'Use `Vec<T>` or ``a`<b`` and $a < b$ here, but Vec<T>.',
    ].join('\n')
    expect(escapeOutlineText(src)).toBe(src.replace('but Vec<T>', 'but Vec&lt;T>'))
  })

  it('does not treat prices as math', () => {
    expect(escapeOutlineText('From $5 < $10.')).toBe('From $5 &lt; $10.')
  })

  it('keeps backslash escapes and unmatched backticks intact', () => {
    expect(escapeOutlineText('\\` then <b')).toBe('\\` then &lt;b')
    expect(escapeOutlineText('\\<x')).toBe('\\<x')
  })

  it('handles nested fences of different lengths', () => {
    const src = '````md\n```js\n<a>\n```\n````\n<b>'
    expect(escapeOutlineText(src)).toBe('````md\n```js\n<a>\n```\n````\n&lt;b>')
  })
})

describe('escaped Outline text in a VitePress page', () => {
  let md: MarkdownRenderer
  beforeAll(async () => {
    md = await createMarkdownRenderer(path.resolve('content'), { config: configureMarkdown })
  })

  /** Renders like a page build: Markdown -> HTML -> Vue template compile */
  function build(markdown: string): { html: string; errors: unknown[] } {
    const html = md.render(markdown, { relativePath: 'posts/x.md' })
    const { errors } = compileTemplate({ source: `<div>${html}</div>`, filename: 'x.vue', id: 'x' })
    return { html, errors }
  }

  it('the raw text breaks the page compile (the bug)', () => {
    expect(build('A Vec<String> holds strings.').errors).not.toHaveLength(0)
  })

  it('the escaped text compiles and shows exactly what was typed', () => {
    const { html, errors } = build(escapeOutlineText('A Vec<String> holds {{ 1 + 1 }} and <br> stays.'))
    expect(errors).toHaveLength(0)
    expect(html).toContain('Vec&lt;String&gt;')
    expect(html).toContain('&#123;&#123; 1 + 1 }}')
  })
})
