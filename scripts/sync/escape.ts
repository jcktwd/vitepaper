/**
 * Makes Outline text render literally in VitePress.
 *
 * Outline's Markdown export doesn't escape `<` or `{{`, but VitePress compiles each page as a Vue
 * template: `Vec<String>` typed in Outline prose is an unclosed tag that fails the whole build, and
 * `{{ 1 + 1 }}` is evaluated (showing `2`). Outline displays both as plain text, so escape them.
 *
 * Left untouched: fenced code, `$$` math blocks, inline code and `$math$`, backslash escapes, and the
 * two kinds of `<` Outline emits itself: `<br>` (line breaks in table cells) and autolinks
 * (`<https://…>`, written when a link's text equals its URL).
 */

const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/
const MATH_BLOCK_RE = /^[ \t]*\$\$[ \t]*$/
// CommonMark autolinks: `<scheme:…>` and `<user@host>`
const AUTOLINK_RE = /^<(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*|[^\s@<>]+@[^\s@<>]+)>/
const BR_RE = /^<br\s*\/?>/i

export function escapeOutlineText(markdown: string): string {
  const lines = markdown.split('\n')
  let fence: string | null = null
  let inMathBlock = false

  return lines
    .map((line) => {
      const fenceMatch = line.match(FENCE_RE)
      if (fence) {
        if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null
        return line
      }
      if (fenceMatch) {
        fence = fenceMatch[1]
        return line
      }
      if (MATH_BLOCK_RE.test(line)) {
        inMathBlock = !inMathBlock
        return line
      }
      return inMathBlock ? line : escapeInline(line)
    })
    .join('\n')
}

function escapeInline(line: string): string {
  let out = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]

    // Backslash escape: keep the pair as-is
    if (ch === '\\' && i + 1 < line.length) {
      out += line.slice(i, i + 2)
      i += 2
      continue
    }

    // Inline code: a run of N backticks up to the next run of exactly N
    if (ch === '`') {
      const run = line.slice(i).match(/^`+/)![0]
      const close = findClosingRun(line, i + run.length, run.length)
      if (close !== -1) {
        out += line.slice(i, close + run.length)
        i = close + run.length
        continue
      }
      out += run
      i += run.length
      continue
    }

    // Inline math: `$…$` with no space just inside either `$` (so "$5 and $10" stays text)
    if (ch === '$') {
      const math = line.slice(i).match(/^\$(?!\s)[^$\n]*?[^\s\\$]\$(?!\d)/)
      if (math) {
        out += math[0]
        i += math[0].length
        continue
      }
    }

    if (ch === '<') {
      const keep = line.slice(i).match(BR_RE) ?? line.slice(i).match(AUTOLINK_RE)
      if (keep) {
        out += keep[0]
        i += keep[0].length
        continue
      }
      out += '&lt;'
      i++
      continue
    }

    if (ch === '{' && line[i + 1] === '{') {
      out += '&#123;&#123;'
      i += 2
      continue
    }

    out += ch
    i++
  }
  return out
}

/** Index of the next run of exactly `length` backticks at or after `from`, or -1. */
function findClosingRun(line: string, from: number, length: number): number {
  for (let j = from; j < line.length; ) {
    if (line[j] !== '`') {
      j++
      continue
    }
    const run = line.slice(j).match(/^`+/)![0]
    if (run.length === length) return j
    j += run.length
  }
  return -1
}
