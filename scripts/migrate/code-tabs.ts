import { extractCodeBlockTabMeta } from '../../content/.vitepress/lib/markdown/code-tabs.ts'

/** One code block whose legacy `tab` / `tab-group` directive gets rewritten to `[!…]` markers */
export interface CodeTabEdit {
  /** The legacy directive line(s), e.g. `[tab-group: auth, tab: Request Headers]\n` */
  oldDirective: string
  /** The replacement marker line, e.g. `[!tab Request Headers] [!group auth]\n` */
  newDirective: string
  /** Text to find in the document (the directive, extended with following lines until unique) */
  findText: string
  /** `findText` with the directive replaced */
  replaceText: string
}

const FENCE_RE = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm

/**
 * Plans the rewrite of every legacy code-tab directive in an Outline document's Markdown.
 *
 * Each edit's `findText` occurs exactly once in `markdown`, so it can be applied with Outline's
 * `documents.update` patch mode (which replaces the first match). Directives that can't be made
 * unique within their code block are returned in `ambiguous` instead.
 */
export function planCodeTabMigration(markdown: string): { edits: CodeTabEdit[]; ambiguous: string[] } {
  const edits: CodeTabEdit[] = []
  const ambiguous: string[] = []

  for (const match of markdown.matchAll(FENCE_RE)) {
    const rawBody = match[1]
    const meta = extractCodeBlockTabMeta(rawBody)
    if (!meta.tab) continue

    const oldDirective = rawBody.slice(0, rawBody.length - meta.body.length)
    const markers = [`[!tab ${meta.tab}]`, ...(meta.group ? [`[!group ${meta.group}]`] : [])]
    const newDirective = `${markers.join(' ')}\n`

    // Extend the find text line by line into the block until it occurs once in the document
    const bodyLines = meta.body.split(/(?<=\n)/)
    let findText = oldDirective
    for (let i = 0; countOccurrences(markdown, findText) > 1 && i < bodyLines.length; i++) {
      findText += bodyLines[i]
    }
    if (countOccurrences(markdown, findText) !== 1) {
      ambiguous.push(oldDirective.trimEnd())
      continue
    }

    edits.push({
      oldDirective,
      newDirective,
      findText,
      replaceText: newDirective + findText.slice(oldDirective.length),
    })
  }

  return { edits, ambiguous }
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) count++
  return count
}
