import type { MarkdownRenderer as MarkdownIt } from 'vitepress'

const DIMENSIONS_RE = /\bwidth="(\d+)"\s+height="(\d+)"/

/**
 * Wraps the (UnlazyImages) image renderer so that it:
 * - populates `alt` in `token.attrs`, so UnlazyImages forwards the alt text to <NolebaseUnlazyImg>
 * - supports local `.webp` images (ThumbHash entries are aliased as `<file>.webp.png`, see `thumbhash.ts`)
 * - preserves the natural aspect ratio when only `width` or `height` is set
 * - ensures `env.relativePath` is present when `createContentLoader` renders markdown
 *
 * Must be registered after `UnlazyImages`.
 */
export function patchImageRenderer(md: MarkdownIt): void {
  const unlazyImageRule = md.renderer.rules.image!
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (!token.attrGet('alt') && token.content) {
      token.attrSet('alt', token.content)
    }
    if (env && !env.path && !env.relativePath) {
      env.relativePath = 'index.md'
    }
    const origSrc = token.attrGet('src')
    const explicitWidth = token.attrGet('width')
    const explicitHeight = token.attrGet('height')

    // Temporarily clear single-axis width/height so UnlazyImages emits the natural originalWidth & originalHeight
    if (explicitWidth && !explicitHeight && token.attrs) {
      token.attrs = token.attrs.filter(([k]) => k !== 'width')
    } else if (explicitHeight && !explicitWidth && token.attrs) {
      token.attrs = token.attrs.filter(([k]) => k !== 'height')
    }

    const isLocalWebp =
      origSrc && !/^(?:[a-z]+:|\/\/)/i.test(origSrc) && origSrc.toLowerCase().endsWith('.webp')
    if (isLocalWebp) {
      token.attrSet('src', `${origSrc}.png`)
    }
    let rendered = unlazyImageRule(tokens, idx, options, env, self)
    if (isLocalWebp && origSrc) {
      token.attrSet('src', origSrc)
      rendered = rendered.replace(/\.webp\.png"/g, '.webp"')
    }

    // Restore explicit single-axis dimension and compute proportional counterpart from natural dimensions
    if (explicitWidth && !explicitHeight) {
      token.attrSet('width', explicitWidth)
    } else if (explicitHeight && !explicitWidth) {
      token.attrSet('height', explicitHeight)
    }
    return applySingleAxisSize(rendered, explicitWidth, explicitHeight)
  }
}

/**
 * Given rendered image HTML carrying the natural `width="W" height="H"`, rescales it to the one
 * explicitly requested dimension while keeping the aspect ratio. Returns `html` unchanged when
 * both or neither dimension was requested.
 */
export function applySingleAxisSize(
  html: string,
  explicitWidth: string | null,
  explicitHeight: string | null
): string {
  if (Boolean(explicitWidth) === Boolean(explicitHeight)) return html

  const m = html.match(DIMENSIONS_RE)
  if (!m) return html
  const natW = Number(m[1])
  const natH = Number(m[2])
  if (natW <= 0 || natH <= 0) return html

  let targetW: number
  let targetH: number
  if (explicitWidth) {
    targetW = Number(explicitWidth)
    if (!(targetW > 0)) return html
    targetH = Math.max(1, Math.round((targetW * natH) / natW))
  } else {
    targetH = Number(explicitHeight)
    if (!(targetH > 0)) return html
    targetW = Math.max(1, Math.round((targetH * natW) / natH))
  }

  return html
    .replace(/\bautoSizes="true"/, 'autoSizes="false"')
    .replace(DIMENSIONS_RE, `width="${targetW}" height="${targetH}"`)
}
