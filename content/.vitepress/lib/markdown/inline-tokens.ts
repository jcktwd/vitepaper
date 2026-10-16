import type { MarkdownRenderer as MarkdownIt } from 'vitepress'

const ICON_SHORTHANDS: Record<string, string> = {
  vue: 'simple-icons/vuedotjs',
  nodejs: 'simple-icons/nodedotjs',
  node: 'simple-icons/nodedotjs',
  nextjs: 'simple-icons/nextdotjs',
  csharp: 'simple-icons/csharp',
  'c#': 'simple-icons/csharp',
  cpp: 'simple-icons/cplusplus',
  'c++': 'simple-icons/cplusplus',
  '.net': 'simple-icons/dotnet',
  tailwind: 'simple-icons/tailwindcss',
  postgres: 'simple-icons/postgresql',
  ha: 'simple-icons/homeassistant',
  rss: 'lucide/rss',
}
const MULTICOLOR_PREFIXES = new Set(['logos', 'devicon', 'vscode-icons', 'skill-icons', 'fluent-emoji', 'twemoji', 'noto'])

/**
 * Renders Outline-friendly inline code tokens, or returns `null` for ordinary inline code:
 * - `integration: socials` (or `vitepaper: socials`) -> <SocialLinks />
 * - `icon:<brand>` or `icon:<prefix>:<name>` -> inline Iconify / Simple Icons SVG
 */
const ICON_RE = /^icon:[a-z0-9_+#.-]+(?::[a-z0-9_+#.-]+)?$/i

/** `icon:<brand>` / `icon:<prefix>:<name>` inline code */
export function isInlineIcon(content: string): boolean {
  return ICON_RE.test(content.trim())
}

export function renderInlineToken(content: string): string | null {
  const raw = content.trim()

  if (/^(?:integration|vitepaper):\s*socials$/i.test(raw)) {
    return '<SocialLinks />'
  }

  if (isInlineIcon(raw)) {
    const spec = raw.slice(5).toLowerCase()
    let iconPath: string
    let prefix = 'simple-icons'

    if (ICON_SHORTHANDS[spec]) {
      iconPath = ICON_SHORTHANDS[spec]
      prefix = iconPath.split('/')[0]
    } else if (spec.includes(':')) {
      const parts = spec.split(':')
      prefix = parts[0]
      iconPath = `${parts[0]}/${parts[1]}`
    } else {
      iconPath = `simple-icons/${spec}`
    }

    const url = `https://api.iconify.design/${iconPath}.svg`
    if (MULTICOLOR_PREFIXES.has(prefix)) {
      return `<img class="vp-inline-icon-img" src="${url}" alt="${spec}" loading="lazy" />`
    }
    return `<span class="vp-inline-icon vp-mask-icon" style="--icon-url: url('${url}')" role="img" aria-label="${spec}"></span>`
  }

  return null
}

/**
 * Inline icons render as inline-blocks, and browsers allow a line break right after one, even
 * before a no-break space. So each icon is wrapped together with the space after it in a
 * `white-space: nowrap` span (`.vp-icon-glue`), and that space becomes a no-break space so nothing
 * can break between it and the next word either. A line then never ends with an icon whose link
 * (`icon:ghost` [Ghost](…)) has wrapped onto the next line.
 */
const NO_BREAK_SPACE = String.fromCharCode(0xa0)
/** Used instead when the next token follows the icon directly, with no space */
const WORD_JOINER = String.fromCharCode(0x2060)

export function inlineTokensPlugin(md: MarkdownIt): void {
  const defaultCodeInline = md.renderer.rules.code_inline!
  md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
    const rendered = renderInlineToken(tokens[idx].content)
    if (rendered === null) return defaultCodeInline(tokens, idx, options, env, self)
    const glue = tokens[idx].meta?.iconGlue as string | undefined
    return glue ? `<span class="vp-icon-glue">${rendered}${glue}</span>` : rendered
  }

  md.core.ruler.after('inline', 'glue-inline-icons', (state) => {
    for (const block of state.tokens) {
      const children = block.type === 'inline' ? block.children : null
      if (!children) continue
      children.forEach((token, i) => {
        const next = children[i + 1]
        if (token.type !== 'code_inline' || !isInlineIcon(token.content) || !next) return
        if (next.type === 'softbreak' || next.type === 'hardbreak') return
        if (next.type === 'text' && /^\s/.test(next.content)) {
          // The space moves inside the wrapper as a no-break space
          next.content = next.content.replace(/^\s+/, '')
          token.meta = { ...token.meta, iconGlue: NO_BREAK_SPACE }
        } else {
          token.meta = { ...token.meta, iconGlue: WORD_JOINER }
        }
      })
    }
  })
}
