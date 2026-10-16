import path from 'node:path'
import { createMarkdownRenderer, type MarkdownRenderer } from 'vitepress'
import { beforeAll, describe, expect, it } from 'vitest'
import { configureMarkdown } from '../../content/.vitepress/lib/markdown/index.ts'
import { isInlineIcon } from '../../content/.vitepress/lib/markdown/inline-tokens.ts'

const NBSP = String.fromCharCode(0xa0)
const WORD_JOINER = String.fromCharCode(0x2060)
let md: MarkdownRenderer
const render = (src: string) => md.render(src, { relativePath: 'posts/x.md' })
/** The icon wrapped with what glues it to the next token */
const glued = (iconHtml: string, glue: string) => `<span class="vp-icon-glue">${iconHtml}${glue}</span>`
const icon = (name: string, path = `simple-icons/${name}`) =>
  `<span class="vp-inline-icon vp-mask-icon" style="--icon-url: url('https://api.iconify.design/${path}.svg')" role="img" aria-label="${name}"></span>`

beforeAll(async () => {
  md = await createMarkdownRenderer(path.resolve('content'), { config: configureMarkdown })
})

describe('isInlineIcon', () => {
  it('matches icon specs only', () => {
    expect(isInlineIcon('icon:ghost')).toBe(true)
    expect(isInlineIcon(' icon:lucide:cpu ')).toBe(true)
    expect(isInlineIcon('icon: ghost')).toBe(false)
    expect(isInlineIcon('const icon = 1')).toBe(false)
  })
})

// Inline-block icons allow a line break right after them even before a no-break space, so the icon
// and the space after it share a nowrap wrapper (.vp-icon-glue in style.css).
describe('inline icons stay attached to what follows them', () => {
  it('wraps the icon and a no-break space before a following link', () => {
    // Links render through the inline link preview component rather than a bare <a>
    const html = render('Hosted options like `icon:ghost` [Ghost](https://ghost.org/) exist.')
    expect(html).toContain(`like ${glued(icon('ghost'), NBSP)}<VPNolebaseInlineLinkPreview href="https://ghost.org/"`)
  })

  it('collapses several spaces into the one no-break space', () => {
    expect(render('`icon:astro`   [Astro](https://astro.build/)')).toContain(`${glued(icon('astro'), NBSP)}<VPNolebaseInlineLinkPreview`)
  })

  it('works before plain words, bold text, and for multicolour <img> icons', () => {
    expect(render('Built with `icon:vue` VitePress.')).toContain(`${glued(icon('vue', 'simple-icons/vuedotjs'), NBSP)}VitePress.`)
    expect(render('`icon:github` **GitHub**')).toContain(`${glued(icon('github'), NBSP)}<strong>GitHub</strong>`)
    expect(render('`icon:logos:docker` Docker')).toMatch(
      new RegExp(`<span class="vp-icon-glue"><img class="vp-inline-icon-img"[^>]*/>${NBSP}</span>Docker`)
    )
  })

  it('uses a word joiner when the next token follows directly', () => {
    expect(render('`icon:ghost`**Ghost**')).toContain(`${glued(icon('ghost'), WORD_JOINER)}<strong>Ghost</strong>`)
  })

  it('leaves icons at the end of a line, and ordinary inline code, unwrapped', () => {
    expect(render('`icon:ghost`\nnext line')).not.toContain('vp-icon-glue')
    expect(render('Run `pnpm build` now.')).toContain('<code>pnpm build</code> now.')
  })
})
