import { createMathjaxInstance, mathjax } from '@mdit/plugin-mathjax/sync'
import { createMarkdownRenderer, disposeMdItInstance, type MarkdownRenderer as MarkdownIt } from 'vitepress'

/**
 * Maths (`$inline$` and `$$block$$`) with MathJax 4 via @mdit/plugin-mathjax, instead of VitePress's
 * built-in `markdown.math`, which needs the older markdown-it-mathjax3 v4 (MathJax 3); v5 of that
 * plugin puts a `<style>` in every formula, which Vue rejects in page templates.
 *
 * SVG output draws each formula's glyphs inside its own <svg>, so the CSS it needs is the same for
 * every page: it's collected once (mathjaxStylesheet) and added to the page head.
 */
const MATHJAX_OPTIONS = { output: 'svg', delimiters: 'dollars' } as const

let instance: ReturnType<typeof createMathjaxInstance> | undefined

export function mathPlugin(md: MarkdownIt): void {
  instance ??= createMathjaxInstance(MATHJAX_OPTIONS)
  if (!instance) throw new Error('MathJax could not load its TeX input')
  // Typed against markdown-it 15, VitePress 1.x ships 14 (like the other @mdit plugins)
  md.use(mathjax as unknown as Parameters<MarkdownIt['use']>[0], instance)
}

/** The CSS for MathJax's SVG output, collected by rendering a sample with a separate instance */
export async function mathjaxStylesheet(srcDir: string): Promise<string> {
  const styleInstance = createMathjaxInstance(MATHJAX_OPTIONS)
  if (!styleInstance) throw new Error('MathJax could not load its TeX input')
  const md = await createMarkdownRenderer(srcDir, {
    config: (m) => m.use(mathjax as unknown as Parameters<MarkdownIt['use']>[0], styleInstance),
  })
  try {
    md.render('$x$\n\n$$x$$', { relativePath: 'mathjax-styles.md' })
    return styleInstance.outputStyle()
  } finally {
    // VitePress caches the first renderer it creates and hands it to every later caller, so this
    // maths-only one must be released, or the site would be built without its other plugins
    disposeMdItInstance()
  }
}

/** MathJax's output elements (`<mjx-container>`, …), which Vue must leave alone */
export const isMathjaxElement = (tag: string): boolean => tag.startsWith('mjx-')
