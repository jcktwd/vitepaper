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
export function renderInlineToken(content: string): string | null {
  const raw = content.trim()

  if (/^(?:integration|vitepaper):\s*socials$/i.test(raw)) {
    return '<SocialLinks />'
  }

  if (/^icon:[a-z0-9_+#.-]+(?::[a-z0-9_+#.-]+)?$/i.test(raw)) {
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

export function inlineTokensPlugin(md: MarkdownIt): void {
  const defaultCodeInline = md.renderer.rules.code_inline!
  md.renderer.rules.code_inline = (tokens, idx, options, env, self) =>
    renderInlineToken(tokens[idx].content) ?? defaultCodeInline(tokens, idx, options, env, self)
}
