import container from 'markdown-it-container'
import type { MarkdownRenderer as MarkdownIt } from 'vitepress'

const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/
const TOGGLE_MARKER_RE = /^([ \t]*)(\+{3,})[ \t]*$/
const HEADING_RE = /^#{1,6}[ \t]+/
// Lines that start a block of their own, so they can't be (part of) a toggle's summary paragraph
const NON_SUMMARY_RE = /^(?:`{3}|~{3}|:{3}|\+{3}|!\[|\||>|[-*+][ \t]|\d+[.)][ \t])/

/**
 * Converts Outline toggle blocks into VitePress `details` containers.
 *
 * Outline serializes a toggle as a `+++` line, its head (the first paragraph or heading, shown
 * while collapsed), the body, and a closing `+++` line. Outer toggles use more `+` than the
 * toggles nested inside them, so each one maps to a colon fence one longer than its `+` fence:
 * always longer than the `:::` of the notices and code groups it may contain.
 *
 * ```md
 * +++
 * Summary
 *
 * Body
 * +++
 * ```
 * becomes `:::: details Summary` … `::::`. Unpaired markers and anything inside fenced code are left alone.
 */
export function transformToggleBlocks(src: string): string {
  const lines = src.split('\n')
  const pairs = findTogglePairs(lines)
  if (pairs.size === 0) return src

  const dropped = new Set<number>()
  for (const [open, close] of pairs) {
    const [, indent, plus] = lines[open].match(TOGGLE_MARKER_RE)!
    const fence = ':'.repeat(plus.length + 1)
    const summary = takeSummary(lines, open, close, dropped)
    lines[open] = `${indent}${fence} details${summary ? ` ${summary}` : ''}`
    lines[close] = `${indent}${fence}`
  }
  return lines.filter((_, i) => !dropped.has(i)).join('\n')
}

/** Matches opening and closing `+++` lines (same indent and length) outside fenced code. */
function findTogglePairs(lines: string[]): Map<number, number> {
  const pairs = new Map<number, number>()
  const stack: Array<{ key: string; line: number }> = []
  let fence: string | null = null

  lines.forEach((line, i) => {
    const fenceMatch = line.match(FENCE_RE)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length && !line.trim().slice(fenceMatch[1].length)) {
        fence = null
      }
      return
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      return
    }

    const marker = line.match(TOGGLE_MARKER_RE)
    if (!marker) return
    const key = marker[1] + marker[2]
    if (stack.at(-1)?.key === key) {
      pairs.set(stack.pop()!.line, i)
    } else {
      stack.push({ key, line: i })
    }
  })
  return pairs
}

/**
 * Takes the toggle's head paragraph (or heading) as plain summary text, marking its lines in
 * `dropped`. Returns '' when the toggle starts with something else (code, a list, an image...).
 */
function takeSummary(lines: string[], open: number, close: number, dropped: Set<number>): string {
  let i = open + 1
  while (i < close && !lines[i].trim()) i++
  if (i >= close) return ''

  const first = lines[i].trim()
  if (HEADING_RE.test(first)) {
    dropped.add(i)
    return first.replace(HEADING_RE, '').trim()
  }
  if (NON_SUMMARY_RE.test(first)) return ''

  const parts: string[] = []
  for (; i < close && lines[i].trim() && !NON_SUMMARY_RE.test(lines[i].trim()); i++) {
    parts.push(lines[i].trim())
    dropped.add(i)
  }
  return parts.join(' ')
}

/**
 * Registers Outline's green `:::success` notice, which VitePress has no container for.
 * Renders the same markup as VitePress's own `tip` / `info` / `warning` / `danger` containers.
 */
export function successContainerPlugin(md: MarkdownIt): void {
  const render: RenderRule = (tokens, idx, _options, env) => {
    const token = tokens[idx]
    if (token.nesting !== 1) return '</div>\n'
    const title = md.renderInline(token.info.trim().slice('success'.length).trim() || 'SUCCESS', {
      references: env.references,
    })
    return `<div class="success custom-block"${md.renderer.renderAttrs(token)}><p class="custom-block-title">${title}</p>\n`
  }
  md.use(container, 'success', { render })
}

type RenderRule = NonNullable<MarkdownIt['renderer']['rules'][string]>
