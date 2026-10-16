import { describe, expect, it } from 'vitest'
import { extractCodeBlockMeta } from '../../content/.vitepress/lib/markdown/code-tabs.ts'
import { planCodeTabMigration } from '../../scripts/migrate/code-tabs.ts'

const apply = (markdown: string) =>
  planCodeTabMigration(markdown).edits.reduce((text, e) => text.replace(e.findText, e.replaceText), markdown)

describe('planCodeTabMigration', () => {
  it('rewrites every legacy form to [!tab] / [!group] markers', () => {
    const markdown = [
      '```http', '[tab-group: auth, tab: Request Headers]', 'GET /', '```',
      '```json', '[tab: Response]', '{}', '```',
      '```http', '[tab-group: req]', '[tab: Body]', 'x', '```',
      '```sh', '--- tab-group: cli, tab: Shell ---', 'ls', '```',
      '```yaml', '---', 'tab-group: response', 'tab: YAML', '---', 'a: 1', '```',
    ].join('\n')
    expect(apply(markdown)).toBe(
      [
        '```http', '[!tab Request Headers] [!group auth]', 'GET /', '```',
        '```json', '[!tab Response]', '{}', '```',
        '```http', '[!tab Body] [!group req]', 'x', '```',
        '```sh', '[!tab Shell] [!group cli]', 'ls', '```',
        '```yaml', '[!tab YAML] [!group response]', 'a: 1', '```',
      ].join('\n')
    )
  })

  it('produces markers that parse back to the same metadata', () => {
    for (const body of ['[tab-group: auth, tab: Request Headers]\nGET /\n', '--- tab-group: cli, tab: Shell ---\nls\n']) {
      const migrated = apply('```\n' + body + '```').slice(4, -3)
      expect(extractCodeBlockMeta(migrated)).toEqual(extractCodeBlockMeta(body))
    }
  })

  it('extends repeated directives with following code lines until each is unique', () => {
    const markdown = ['```', '[tab: Request]', 'GET /a', '```', '', '```', '[tab: Request]', 'GET /b', '```'].join('\n')
    const { edits } = planCodeTabMigration(markdown)
    expect(edits.map((e) => e.findText)).toEqual(['[tab: Request]\nGET /a\n', '[tab: Request]\nGET /b\n'])
    expect(apply(markdown)).not.toContain('[tab:')
  })

  it('reports blocks that are identical and so cannot be matched uniquely', () => {
    const block = ['```', '[tab: Same]', 'x', '```'].join('\n')
    expect(planCodeTabMigration(`${block}\n\n${block}`)).toEqual({ edits: [], ambiguous: ['[tab: Same]', '[tab: Same]'] })
  })

  it('ignores blocks without legacy directives', () => {
    expect(planCodeTabMigration('```ts\n// [!tab New]\nx\n```\n```ts\nconst a = [1]\n```').edits).toEqual([])
  })
})
