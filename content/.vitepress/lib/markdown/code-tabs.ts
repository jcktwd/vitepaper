import YAML from 'yaml'

export interface CodeBlockTabMeta {
  body: string
  tab?: string
  group?: string
}

export interface CodeBlockMeta extends CodeBlockTabMeta {
  filename?: string
  /** VitePress line highlight ranges, e.g. `2-4,7` (from `[!highlight 2-4, 7]`) */
  highlight?: string
  /** `true` / start line from `[!line-numbers]` / `[!line-numbers 10]`; `false` from `[!no-line-numbers]` */
  lineNumbers?: boolean | number
}

const MARKER_RE = /\[!(tab|filename|group|highlight|line-numbers|no-line-numbers)(?:[ \t]+([^\]\n]*?))?[ \t]*\]/gi
const MARKER_WITH_SPACE_RE = new RegExp(`[ \\t]*${MARKER_RE.source}`, 'gi')
// Comment delimiters (any language) that may wrap a marker line, e.g. `// …`, `# …`, `<!-- … -->`
const COMMENT_DELIMITERS_RE = /<!--|-->|\/\*|\*\/|\(\*|\*\)|\/\/|--|#|;|%|'|"|\bREM\b/gi
/** Marker lines read from the top of a block, e.g. `// [!tab Server]` then `# [!filename app.ts]` */
const MAX_MARKER_LINES = 4
const HIGHLIGHT_RANGES_RE = /^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/

/**
 * Reads markers from the first lines of a fenced code block's body:
 * - `[!tab Name]`, `[!filename path]`, `[!group name]`: tabs and titles (see `transformCodeTabs`)
 * - `[!highlight 2-4, 7]`, `[!line-numbers]`, `[!line-numbers 10]`, `[!no-line-numbers]`: the options
 *   VitePress normally reads from the fence line (`js{2-4,7}`, `:line-numbers`, `:line-numbers=10`,
 *   `:no-line-numbers`), which Outline strips. Line numbers count the code as shown, without marker lines.
 *
 * Markers may sit inside any comment syntax, or none:
 * `// [!tab Server] [!filename src/server.ts]`, `# [!filename deploy.sh]`, `<!-- [!tab HTML] -->`, `[!tab JSON]`.
 * A marker line that holds nothing else is removed. Anything else left on it (e.g. a Shiki
 * `// [!code highlight]`) is kept, minus the markers, and ends the marker lines.
 * Markers with a missing or malformed value are dropped. Falls back to the legacy `tab` / `tab-group`
 * syntaxes (see `extractCodeBlockTabMeta`).
 */
export function extractCodeBlockMeta(rawBody: string): CodeBlockMeta {
  const meta: CodeBlockMeta = { body: rawBody }
  let body = rawBody
  let found = false

  for (let i = 0; i < MAX_MARKER_LINES; i++) {
    const lineEnd = body.indexOf('\n')
    const line = lineEnd === -1 ? body : body.slice(0, lineEnd)
    const markers = [...line.matchAll(MARKER_RE)]
    if (markers.length === 0) break

    found = true
    for (const [, kind, rawValue = ''] of markers) {
      applyMarker(meta, kind.toLowerCase(), rawValue.trim())
    }
    const rest = body.slice(lineEnd === -1 ? body.length : lineEnd + 1)
    const remainder = line.replace(MARKER_WITH_SPACE_RE, '').trimEnd()
    if (remainder.replace(COMMENT_DELIMITERS_RE, '').trim()) {
      body = `${remainder}\n${rest}`
      break
    }
    body = rest
  }

  if (!found) return extractCodeBlockTabMeta(rawBody)
  return { ...meta, body }
}

function applyMarker(meta: CodeBlockMeta, kind: string, value: string): void {
  switch (kind) {
    case 'tab':
    case 'filename':
    case 'group':
      if (value) meta[kind] = value
      break
    case 'highlight': {
      const ranges = value.replace(/\s+/g, '')
      if (HIGHLIGHT_RANGES_RE.test(ranges)) meta.highlight = ranges
      break
    }
    case 'line-numbers':
      if (!value) meta.lineNumbers = true
      else if (/^\d+$/.test(value)) meta.lineNumbers = Number(value)
      break
    case 'no-line-numbers':
      meta.lineNumbers = false
      break
  }
}

function tabMetaFromYaml(parsed: unknown, body: string): CodeBlockTabMeta | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined
  const { tab, 'tab-group': group } = parsed as Record<string, unknown>
  if (typeof tab !== 'string' || !tab.trim()) return undefined
  return {
    body,
    tab: tab.trim(),
    group: typeof group === 'string' && group.trim() ? group.trim() : undefined,
  }
}

/**
 * Legacy syntax: extracts `tab` / `tab-group` metadata from the top of a fenced code block's body.
 * Still read so older posts keep rendering; `scripts/migrate-code-tabs.ts` rewrites it to `[!…]` markers.
 * Supports:
 *   1. YAML frontmatter (`---\ntab-group: req\ntab: Headers\n---` or `--- tab-group: req, tab: Headers ---`)
 *   2. Bracketed shorthand (`[tab-group: req, tab: Headers]`, `[tab-group: req] [tab: Headers]`, or on 2 lines)
 * Returns the body untouched (and no `tab`) when no tab metadata is present.
 */
export function extractCodeBlockTabMeta(rawBody: string): CodeBlockTabMeta {
  // 1. Multi-line `---\n...\n---` YAML frontmatter at the very top of the code block
  const multiYamlMatch = rawBody.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (multiYamlMatch) {
    try {
      const meta = tabMetaFromYaml(YAML.parse(multiYamlMatch[1]), rawBody.slice(multiYamlMatch[0].length))
      if (meta) return meta
    } catch {
      // Not valid tab frontmatter; leave code untouched
    }
  }

  // 2. Single-line `--- ... ---` frontmatter at the top of the code block
  const singleYamlMatch = rawBody.match(/^---[ \t]+([^\n]+?)[ \t]+---[ \t]*(?:\n|$)/)
  if (singleYamlMatch) {
    try {
      const inner = singleYamlMatch[1].trim()
      const yamlText = inner.startsWith('{') ? inner : `{ ${inner} }`
      const meta = tabMetaFromYaml(YAML.parse(yamlText), rawBody.slice(singleYamlMatch[0].length))
      if (meta) return meta
    } catch {
      // Not valid single-line tab frontmatter
    }
  }

  // 3. Up to 2 leading lines of bracketed shorthand:
  //    `[tab: Title]`, `[tab-group: name, tab: Title]`, `[tab-group: name] [tab: Title]`, or on 2 lines
  let body = rawBody
  let tab: string | undefined
  let group: string | undefined

  for (let lineIdx = 0; lineIdx < 2; lineIdx++) {
    const firstLineEnd = body.indexOf('\n')
    const firstLine = (firstLineEnd === -1 ? body : body.slice(0, firstLineEnd)).trim()
    if (!firstLine.startsWith('[') || !firstLine.endsWith(']')) break

    const bracketGroups = [...firstLine.matchAll(/\[([^\]]+)\]/g)]
    if (bracketGroups.length === 0) break

    const stripped = firstLine.replace(/\[[^\]]+\]/g, '').trim()
    if (stripped !== '') break

    let matchedDirective = false
    for (const bg of bracketGroups) {
      const parts = bg[1].split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
      for (const part of parts) {
        const gm = part.match(/^tab-group:\s*(.+)$/i)
        const tm = part.match(/^tab:\s*(.+)$/i)
        if (gm && gm[1].trim()) {
          group = gm[1].trim()
          matchedDirective = true
        } else if (tm && tm[1].trim()) {
          tab = tm[1].trim()
          matchedDirective = true
        } else {
          // Unknown token inside brackets (e.g. JSON array or INI section) -> abort
          return { body: rawBody }
        }
      }
    }

    if (matchedDirective) {
      body = firstLineEnd === -1 ? '' : body.slice(firstLineEnd + 1)
    } else {
      break
    }
  }

  if (!tab) return { body: rawBody }
  return { body, tab, group }
}

const FENCE_RUN_RE = /(?:^```[^\n]*\n[\s\S]*?^```[ \t]*(?:\n|$))(?:[ \t]*\n*^```[^\n]*\n[\s\S]*?^```[ \t]*(?:\n|$))*/gm
const SINGLE_FENCE_RE = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm

/** Info-string attribute carrying a block's filename to the fence renderer (see `fenceFilename`) */
const FILENAME_ATTR = 'data-filename'
const FILENAME_ATTR_RE = new RegExp(`[ \\t]+${FILENAME_ATTR}=(\\S+)`)

/**
 * Transforms fenced code blocks carrying `[!tab]` / `[!filename]` / `[!group]` markers (or the legacy
 * `tab` / `tab-group` syntax) into VitePress code groups and titled blocks:
 * - Consecutive labelled blocks in the same group become one `::: code-group`, each tab labelled
 *   with its `tab`, else its `filename`. With both, the filename is passed on to show beside the language.
 *   The group is the `[!group]` name if given, else tab blocks and filename-only blocks form separate groups.
 * - A lone block with only a `filename` keeps standing alone, titled with it
 *   (rendered as a title bar by `vitepress-plugin-group-icons`).
 * - Highlight and line-number markers become the matching VitePress fence options (see `fenceInfo`).
 */
export function transformCodeTabs(src: string): string {
  return src.replace(FENCE_RUN_RE, (runChunk) => {
    const blocks = [...runChunk.matchAll(SINGLE_FENCE_RE)].map((match) => ({
      raw: match[0],
      rawBody: match[2],
      lang: match[1].trim(),
      ...extractCodeBlockMeta(match[2]),
    }))

    if (blocks.every((b) => b.body === b.rawBody)) {
      return runChunk
    }

    // Split the run into groups of consecutive labelled blocks sharing a group key; unlabelled blocks stand alone.
    // Without a `[!group]`, `[!tab]` blocks and filename-only blocks group separately, so a titled file next to a
    // tab set stays on its own.
    const segments: Array<{ key: string | null; blocks: typeof blocks }> = []
    for (const b of blocks) {
      const key = b.group ? `named:${b.group.toLowerCase()}` : b.tab ? 'default:tab' : b.filename ? 'default:file' : null
      const last = segments.at(-1)
      if (key !== null && last?.key === key) {
        last.blocks.push(b)
      } else {
        segments.push({ key, blocks: [b] })
      }
    }

    const out: string[] = []
    for (const { key, blocks: group } of segments) {
      const [first] = group
      if (key === null) {
        out.push(first.body === first.rawBody ? first.raw + '\n' : `\`\`\`${fenceInfo(first)}\n${first.body}\`\`\`\n`)
      } else if (group.length === 1 && first.filename && !first.tab) {
        out.push(`\`\`\`${fenceInfo(first, first.filename)}\n${first.body}\`\`\`\n`)
      } else {
        out.push('::: code-group\n')
        for (const b of group) {
          const filenameAttr = b.tab && b.filename ? ` ${FILENAME_ATTR}=${encodeURIComponent(b.filename)}` : ''
          out.push(`\`\`\`${fenceInfo(b, b.tab ?? b.filename)}${filenameAttr}\n${b.body}\`\`\`\n`)
        }
        out.push(':::\n')
      }
    }

    return out.join('\n')
  })
}

/**
 * Builds a VitePress fence info string, e.g. `ts:line-numbers=10 {2-4} [Server]`:
 * language, then line-number option, highlight ranges and tab / title label.
 */
function fenceInfo(meta: Omit<CodeBlockMeta, 'body'> & { lang: string }, label?: string): string {
  let info = meta.lang || 'txt'
  if (meta.lineNumbers === true) info += ':line-numbers'
  else if (meta.lineNumbers === false) info += ':no-line-numbers'
  else if (typeof meta.lineNumbers === 'number') info += `:line-numbers=${meta.lineNumbers}`
  if (meta.highlight) info += ` {${meta.highlight}}`
  if (label) info += ` [${label}]`
  return info
}

/**
 * Splits the filename attribute added by `transformCodeTabs` off a fence info string.
 * Returns the info string without it, plus the filename if there was one.
 */
export function fenceFilename(info: string): { info: string; filename?: string } {
  const match = info.match(FILENAME_ATTR_RE)
  if (!match) return { info }
  return { info: info.replace(FILENAME_ATTR_RE, ''), filename: decodeURIComponent(match[1]) }
}
