import { figure } from '@mdit/plugin-figure'
import { imgSize, legacyImgSize, obsidianImgSize } from '@mdit/plugin-img-size'
import { mark } from '@mdit/plugin-mark'
import { tasklist } from '@mdit/plugin-tasklist'
import { UnlazyImages } from '@nolebase/markdown-it-unlazy-img'
import { InlineLinkPreviewElementTransform } from '@nolebase/vitepress-plugin-inline-link-preview/markdown-it'
import type { MarkdownRenderer as MarkdownIt } from 'vitepress'
import { groupIconMdPlugin } from 'vitepress-plugin-group-icons'
import { fenceFilename, transformCodeTabs } from './code-tabs.ts'
import { footnotesPlugin } from './footnotes.ts'
import { patchImageRenderer } from './images.ts'
import { inlineTokensPlugin } from './inline-tokens.ts'
import { successContainerPlugin, transformToggleBlocks } from './outline-blocks.ts'
import { normalizeOutlineMarkdown } from './outline-fixes.ts'
import { mathPlugin } from './math.ts'
import { videosPlugin } from './videos.ts'

type AnyPlugin = Parameters<MarkdownIt['use']>[0]

export function configureMarkdown(md: MarkdownIt): void {
  // The @mdit/* and @nolebase plugins are typed against newer markdown-it typings than VitePress 1.x
  // ships; they are runtime-compatible, so register them through an untyped `use`.
  const use = (plugin: unknown, ...params: unknown[]) => md.use(plugin as AnyPlugin, ...params)

  // 0. Outline Markdown parity plugins (tasklists, ==highlight==, image sizing, <figure> captions, inline link previews, & ThumbHash lazy images)
  use(tasklist)
  use(mark)
  use(legacyImgSize)
  use(imgSize)
  use(obsidianImgSize)
  use(figure, { focusable: false })
  use(InlineLinkPreviewElementTransform)
  use(UnlazyImages(), {
    imgElementTag: 'NolebaseUnlazyImg',
  })
  patchImageRenderer(md)

  // 1. Normalize Outline ProseMirror serialization quirks, resized image titles, toggle blocks, & tabbed code blocks
  md.core.ruler.before('normalize', 'outline-prosemirror-fixes', (state) => {
    state.src = transformCodeTabs(transformToggleBlocks(normalizeOutlineMarkdown(state.src)))
  })

  // Outline's green `:::success` notice
  md.use(successContainerPlugin)

  // `[^1]` footnotes, and Outline video links (`[title WxH](file.mp4)`) as <video> players
  md.use(footnotesPlugin)
  md.use(videosPlugin)

  // `$inline$` and `$$block$$` maths with MathJax 4 (see math.ts)
  md.use(mathPlugin)

  // 2. Render ```mermaid fenced blocks via our native <Mermaid /> Vue component, and show a tabbed
  //    block's filename (from `[!tab …] [!filename …]`) beside its language in the corner label
  const defaultFence = md.renderer.rules.fence!
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.info.trim().toLowerCase() === 'mermaid') {
      return `<Mermaid code="${encodeURIComponent(token.content)}" />`
    }
    const { info, filename } = fenceFilename(token.info)
    if (!filename) return defaultFence(tokens, idx, options, env, self)

    token.info = info
    return defaultFence(tokens, idx, options, env, self).replace(
      /<span class="lang">([^<]*)<\/span>/,
      (_, lang: string) =>
        `<span class="lang has-filename"><span class="lang-filename">${md.utils.escapeHtml(filename)}</span>${lang ? ` · ${lang}` : ''}</span>`
    )
  }

  // 3. `integration: socials` and `icon:<name>` inline tokens
  md.use(inlineTokensPlugin)

  // 4. File & tool icons on code-group tabs, and a title bar for lone blocks with a `[!filename]`.
  //    Registered last so it wraps the fence renderer above.
  use(groupIconMdPlugin)
}
