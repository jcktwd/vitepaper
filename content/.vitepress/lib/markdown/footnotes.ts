import footnote from 'markdown-it-footnote'
import type { MarkdownRenderer as MarkdownIt } from 'vitepress'

/**
 * GFM-style footnotes (`text[^1]` + `[^1]: note`). Neither Outline nor VitePress supports them
 * natively, but Outline exports `[^…]` untouched, so they can be typed as plain text in Outline.
 *
 * Renders references as bare superscript numbers (instead of the plugin's `[1]`), and the notes
 * as a labelled section at the end of the post.
 */
export function footnotesPlugin(md: MarkdownIt): void {
  // markdown-it-footnote is typed against @types/markdown-it, VitePress against its own copy
  md.use(footnote as unknown as Parameters<MarkdownIt['use']>[0])

  md.renderer.rules.footnote_caption = (tokens, idx) => {
    const { id, subId } = tokens[idx].meta as { id: number; subId: number }
    return subId > 0 ? `${id + 1}:${subId}` : `${id + 1}`
  }

  md.renderer.rules.footnote_block_open = () =>
    '<hr class="footnotes-sep">\n<section class="footnotes" aria-label="Footnotes">\n<ol class="footnotes-list">\n'
}
