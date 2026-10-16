import { createMarkdownRenderer, type MarkdownRenderer } from 'vitepress'
import { beforeAll, describe, expect, it } from 'vitest'
import { extractCodeBlockMeta, fenceFilename, transformCodeTabs } from '../../content/.vitepress/lib/markdown/code-tabs.ts'
import { configureMarkdown } from '../../content/.vitepress/lib/markdown/index.ts'

const fence = (lang: string, ...lines: string[]) => ['```' + lang, ...lines, '```'].join('\n')

describe('extractCodeBlockMeta', () => {
  it.each([
    ['// [!tab Server]\n', '//'],
    ['# [!tab Server]\n', '#'],
    ['-- [!tab Server]\n', '--'],
    ['<!-- [!tab Server] -->\n', 'HTML'],
    ['/* [!tab Server] */\n', 'block'],
    ['[!tab Server]\n', 'bare'],
  ])('reads %j (%s comment) and drops the marker line', (line) => {
    expect(extractCodeBlockMeta(`${line}code\n`)).toEqual({ body: 'code\n', tab: 'Server' })
  })

  it('reads several markers on one line, or across leading lines', () => {
    expect(extractCodeBlockMeta('// [!tab Server] [!filename src/server.ts] [!group api]\nx\n')).toEqual({
      body: 'x\n',
      tab: 'Server',
      filename: 'src/server.ts',
      group: 'api',
    })
    expect(extractCodeBlockMeta('// [!tab Server]\n// [!filename server.ts]\nx\n')).toEqual({
      body: 'x\n',
      tab: 'Server',
      filename: 'server.ts',
    })
  })

  it('keeps Shiki [!code] notation sharing the marker line', () => {
    expect(extractCodeBlockMeta('// [!tab A] [!code highlight]\nx\n')).toEqual({ body: '// [!code highlight]\nx\n', tab: 'A' })
  })

  it('keeps label text such as group-icons ~icon~ syntax', () => {
    expect(extractCodeBlockMeta('# [!tab Docker ~logos:docker~]\nx\n').tab).toBe('Docker ~logos:docker~')
  })

  it('falls back to the legacy syntax', () => {
    expect(extractCodeBlockMeta('[tab-group: req, tab: Headers]\nGET /\n')).toEqual({ body: 'GET /\n', tab: 'Headers', group: 'req' })
  })

  it('reads highlight and line-number options', () => {
    expect(extractCodeBlockMeta('// [!highlight 2, 4-5] [!line-numbers 10]\nx\n')).toEqual({ body: 'x\n', highlight: '2,4-5', lineNumbers: 10 })
    expect(extractCodeBlockMeta('# [!line-numbers]\nx\n').lineNumbers).toBe(true)
    expect(extractCodeBlockMeta('# [!no-line-numbers]\nx\n').lineNumbers).toBe(false)
  })

  it('drops markers with a missing or malformed value', () => {
    expect(extractCodeBlockMeta('// [!highlight two] [!line-numbers x] [!tab]\nx\n')).toEqual({ body: 'x\n' })
  })

  it('leaves ordinary code alone', () => {
    expect(extractCodeBlockMeta('const a = [1]\n')).toEqual({ body: 'const a = [1]\n' })
  })
})

describe('transformCodeTabs', () => {
  it('titles a lone filename block instead of grouping it', () => {
    expect(transformCodeTabs(fence('ts', '// [!filename app.ts]', 'x'))).toBe('```ts [app.ts]\nx\n```\n')
  })

  it('groups consecutive filename-only blocks as file tabs', () => {
    const src = [fence('json', '[!filename package.json]', '{}'), fence('yaml', '# [!filename pnpm-workspace.yaml]', 'a: 1')].join('\n')
    expect(transformCodeTabs(src)).toBe(
      '::: code-group\n\n```json [package.json]\n{}\n```\n\n```yaml [pnpm-workspace.yaml]\na: 1\n```\n\n:::\n'
    )
  })

  it('keeps a filename-only block apart from a neighbouring tab set unless [!group] joins them', () => {
    const titled = fence('ts', '// [!filename server.ts]', 'x')
    const tabs = [fence('sh', '# [!tab Install]', 'i'), fence('sh', '# [!tab Run]', 'r')].join('\n')
    const separate = transformCodeTabs(`${titled}\n\n${tabs}`)
    expect(separate.startsWith('```ts [server.ts]\nx\n```\n')).toBe(true)
    expect(separate.match(/::: code-group/g)).toHaveLength(1)

    const joined = transformCodeTabs(
      [fence('json', '[!filename package.json] [!group setup]', '{}'), fence('sh', '# [!tab Install] [!group setup]', 'i')].join('\n')
    )
    expect(joined).toBe('::: code-group\n\n```json [package.json]\n{}\n```\n\n```sh [Install]\ni\n```\n\n:::\n')
  })

  it('passes the filename on when a block has both a tab and a filename', () => {
    const out = transformCodeTabs(fence('ts', '// [!tab Server] [!filename src/server.ts]', 'x'))
    expect(out).toContain('```ts [Server] data-filename=src%2Fserver.ts\n')
    expect(fenceFilename('ts [Server] data-filename=src%2Fserver.ts')).toEqual({ info: 'ts [Server]', filename: 'src/server.ts' })
  })

  it('turns highlight and line-number markers into VitePress fence options', () => {
    expect(transformCodeTabs(fence('ts', '// [!highlight 2-3]', 'x'))).toBe('```ts {2-3}\nx\n```\n')
    expect(transformCodeTabs(fence('sh', '# [!filename a.sh] [!no-line-numbers]', 'x'))).toBe('```sh:no-line-numbers [a.sh]\nx\n```\n')
    expect(transformCodeTabs(fence('ts', '// [!tab A] [!line-numbers 10] [!highlight 1]', 'x'))).toContain('```ts:line-numbers=10 {1} [A]\n')
  })

  it('splits groups on a [!group] change', () => {
    const src = [fence('sh', '# [!tab A] [!group one]', 'a'), fence('sh', '# [!tab B] [!group two]', 'b')].join('\n')
    expect(transformCodeTabs(src).match(/::: code-group/g)).toHaveLength(2)
  })
})

describe('code markers rendered through VitePress', () => {
  let md: MarkdownRenderer
  beforeAll(async () => {
    md = await createMarkdownRenderer(process.cwd(), { config: configureMarkdown })
  })

  it('renders a filename title bar with the language in the corner', () => {
    const html = md.render(fence('ts', '// [!filename vite.config.ts]', 'x()'))
    expect(html).toContain('<span class="vp-code-block-title-text" data-title="vite.config.ts">vite.config.ts</span>')
    expect(html).toContain('<span class="lang">ts</span>')
  })

  it('shows filename · language in the corner of a tab with both', () => {
    const html = md.render(fence('ts', '// [!tab Server] [!filename src/server.ts]', 'x()'))
    expect(html).toContain('<label data-title="Server"')
    expect(html).toContain('<span class="lang has-filename"><span class="lang-filename">src/server.ts</span> · ts</span>')
  })

  it('highlights and numbers lines counted without the marker lines', () => {
    const html = md.render(fence('ts', '// [!tab A] [!filename a.ts]', '// [!line-numbers 10] [!highlight 2]', 'a()', 'b()'))
    expect([...html.matchAll(/<span class="line-number">(\d+)<\/span>/g)].map((m) => m[1])).toEqual(['10', '11'])
    expect(html).toMatch(/<span class="line highlighted"><span[^>]*>b<\/span>/)
  })

  it('still applies [!code highlight] from the marker line', () => {
    const html = md.render(fence('ts', '// [!tab A] [!code highlight]', 'x()', 'y()'))
    expect(html.match(/class="line highlighted"/g)).toHaveLength(1)
    expect(html).not.toContain('[!tab')
  })
})
