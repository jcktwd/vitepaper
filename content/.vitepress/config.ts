import fs from 'node:fs/promises'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContentLoader, defineConfig, type SiteConfig } from 'vitepress'
import tailwindcss from '@tailwindcss/vite'
import YAML from 'yaml'
import siteConfig from '../../vitepaper.config.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const POSTS_DIR = path.resolve(__dirname, '..', 'posts')
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public')

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Resolves `site.logo` from `vitepaper.config.ts` into VitePress's navbar `logo`
 * and browser `<link rel="icon">` favicon.
 * Supports:
 * - Iconify identifiers (`collection:icon`, e.g. `'majesticons:door-exit'`)
 * - Public file paths (`'/logo.svg'`)
 * - Theme objects (`{ light: '...', dark: '...' }`)
 */
function resolveSiteLogo(logo?: string | { light: string; dark: string }) {
  if (!logo) return { navLogo: undefined, faviconHref: undefined }

  if (typeof logo === 'object') {
    return { navLogo: logo, faviconHref: logo.light }
  }

  // Check if it's an Iconify identifier (`prefix:name`, not starting with http/slash)
  if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(logo)) {
    const [prefix, name] = logo.split(':')
    return {
      navLogo: {
        light: `https://api.iconify.design/${prefix}/${name}.svg?color=%23e14a39`,
        dark: `https://api.iconify.design/${prefix}/${name}.svg?color=%23ff6b01`,
      },
      faviconHref: `https://api.iconify.design/${prefix}/${name}.svg?color=%23e14a39`,
    }
  }

  return { navLogo: logo, faviconHref: logo }
}

/**
 * Dynamically discovers synced Outline articles that have `nav: <label>` in frontmatter
 * so any Outline article can appear on the top navigation bar automatically.
 */
function getOutlineNavItems(): Array<{ text: string; link: string; activeMatch: string }> {
  if (!existsSync(POSTS_DIR)) return []
  const items: Array<{ text: string; link: string; activeMatch: string; order: number }> = []

  for (const file of readdirSync(POSTS_DIR)) {
    if (!file.endsWith('.md')) continue
    const raw = readFileSync(path.join(POSTS_DIR, file), 'utf8')
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch) continue
    try {
      const fm = YAML.parse(fmMatch[1])
      if (fm && fm.nav && !fm.draft) {
        const slug = file.replace(/\.md$/, '')
        const label = typeof fm.nav === 'string' ? fm.nav : fm.title || slug
        items.push({
          text: label,
          link: `/posts/${slug}`,
          activeMatch: `^/posts/${slug}`,
          order: Number(fm.navOrder ?? 50),
        })
      }
    } catch {
      // Ignore invalid frontmatter
    }
  }

  return items
    .sort((a, b) => a.order - b.order || a.text.localeCompare(b.text))
    .map(({ text, link, activeMatch }) => ({ text, link, activeMatch }))
}

const { navLogo, faviconHref } = resolveSiteLogo(siteConfig.site.logo)

export default defineConfig({
  title: siteConfig.site.title,
  description: siteConfig.site.description,
  cleanUrls: true,
  ignoreDeadLinks: true,

  sitemap: {
    hostname: siteConfig.site.url,
    transformItems(items) {
      return items.filter((item) => !item.url.includes('drafts'))
    },
  },

  head: [
    ...(faviconHref ? [['link', { rel: 'icon', type: 'image/svg+xml', href: faviconHref }] as [string, Record<string, string>]] : []),
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
      },
    ],
    [
      'link',
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: `${siteConfig.site.title} RSS Feed`,
        href: `${siteConfig.site.url.replace(/\/+$/, '')}/rss.xml`,
      },
    ],
  ],

  vite: {
    plugins: [tailwindcss() as any],
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    languageAlias: {
      asl: 'c',
      aml: 'c',
      conf: 'ini',
    },
    config(md) {
      // 1. Normalize Outline ProseMirror inline-code + bold serialization quirks & tabbed code blocks
      md.core.ruler.before('normalize', 'outline-prosemirror-fixes', (state) => {
        state.src = state.src
          .replace(/\*\*`\*\*([^`\n]+)\*\*`\*\*/g, '`$1`')
          .replace(/`\*\*([^`\n]+)\*\*`/g, '**`$1`**')
          .replace(/`([^`\n]+)`{2}\*([^*\n]+)\*`/g, '`$1$2`')

        // Transform consecutive fenced code blocks starting with `[tab: ...]` (and optional `[tab-group: ...]`)
        // into native VitePress `::: code-group` containers.
        const fenceRunRe = /(?:^```[^\n]*\n[\s\S]*?^```[ \t]*(?:\n|$))(?:[ \t]*\n*^```[^\n]*\n[\s\S]*?^```[ \t]*(?:\n|$))*/gm
        const singleFenceRe = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm

        state.src = state.src.replace(fenceRunRe, (runChunk) => {
          const blocks: Array<{
            raw: string
            lang: string
            body: string
            tab?: string
            group?: string
          }> = []

          for (const match of runChunk.matchAll(singleFenceRe)) {
            const lang = match[1].trim()
            let body = match[2]
            let tab: string | undefined
            let group: string | undefined

            // Parse up to 2 leading lines for `[tab-group: ...]` and `[tab: ...]` (or both on line 1)
            for (let lineIdx = 0; lineIdx < 2; lineIdx++) {
              const firstLineEnd = body.indexOf('\n')
              const firstLine = (firstLineEnd === -1 ? body : body.slice(0, firstLineEnd)).trim()
              if (!firstLine) break

              const groupMatch = firstLine.match(/\[tab-group:\s*([^\]]+)\]/i)
              const tabMatch = firstLine.match(/\[tab:\s*([^\]]+)\]/i)
              const remainder = firstLine
                .replace(/\[tab-group:\s*([^\]]+)\]/gi, '')
                .replace(/\[tab:\s*([^\]]+)\]/gi, '')
                .trim()

              if ((groupMatch || tabMatch) && remainder === '') {
                if (groupMatch) group = groupMatch[1].trim()
                if (tabMatch) tab = tabMatch[1].trim()
                body = firstLineEnd === -1 ? '' : body.slice(firstLineEnd + 1)
              } else {
                break
              }
            }

            blocks.push({ raw: match[0], lang, body, tab, group })
          }

          if (!blocks.some((b) => b.tab)) {
            return runChunk
          }

          const out: string[] = []
          let currentGroupKey: string | null = null

          for (const b of blocks) {
            if (!b.tab) {
              if (currentGroupKey !== null) {
                out.push(':::\n')
                currentGroupKey = null
              }
              out.push(b.raw + '\n')
              continue
            }

            const groupKey = b.group ? `named:${b.group.toLowerCase()}` : 'default'
            if (currentGroupKey !== groupKey) {
              if (currentGroupKey !== null) {
                out.push(':::\n')
              }
              out.push('::: code-group\n')
              currentGroupKey = groupKey
            }

            const fenceLang = b.lang || 'txt'
            out.push(`\`\`\`${fenceLang} [${b.tab}]\n${b.body}\`\`\`\n`)
          }

          if (currentGroupKey !== null) {
            out.push(':::\n')
          }

          return out.join('\n')
        })
      })

      // 2. Render ```mermaid fenced blocks via our native <Mermaid /> Vue component
      const defaultFence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        if (token.info.trim().toLowerCase() === 'mermaid') {
          return `<Mermaid code="${encodeURIComponent(token.content)}" />`
        }
        return defaultFence(tokens, idx, options, env, self)
      }

      // 3. Support Outline-friendly inline tokens:
      //    - `integration: socials` (or `vitepaper: socials`) -> <SocialLinks />
      //    - `icon:<brand>` or `icon:<prefix>:<name>` -> inline Iconify / Simple Icons SVG
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

      const defaultCodeInline = md.renderer.rules.code_inline!
      md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
        const raw = tokens[idx].content.trim()

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

        return defaultCodeInline(tokens, idx, options, env, self)
      }
    },
  },

  themeConfig: {
    ...(navLogo ? { logo: navLogo } : {}),
    intro: siteConfig.site.intro,
    postsPerPage: siteConfig.site.postsPerPage,

    nav: [
      { text: 'Posts', link: '/posts', activeMatch: '^/posts$' },
      { text: 'Tags', link: '/tags', activeMatch: '^/tags' },
      ...getOutlineNavItems(),
    ],

    search: {
      provider: 'local',
      options: {
        _render(src: string, env: any, md: any) {
          const html = md.render(src, env)
          if (env.frontmatter?.draft || env.relativePath === 'drafts.md') {
            return ''
          }
          return html
        },
      },
    },

    socialLinks: siteConfig.site.socials.map((item) => {
      const iconLower = typeof item.icon === 'string' ? item.icon.toLowerCase() : ''
      const isMail = iconLower === 'mail' || iconLower === 'email'
      const isRss = iconLower === 'rss'

      let resolvedIcon: string | { svg: string } = item.icon
      if (isMail) {
        resolvedIcon = {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
        }
      } else if (isRss) {
        resolvedIcon = {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
        }
      }

      return {
        icon: resolvedIcon,
        link: item.link,
        ariaLabel: item.label || (isMail ? 'Email' : isRss ? 'RSS Feed' : item.icon),
      }
    }),

    footer: {
      message:
        'Published with <a href="https://www.getoutline.com/" target="_blank" rel="noopener">Outline</a> &amp; <a href="https://vitepress.dev/" target="_blank" rel="noopener">VitePress</a> • Theme inspired by <a href="https://github.com/satnaing/astro-paper" target="_blank" rel="noopener">AstroPaper</a>',
      copyright: `Copyright © ${new Date().getFullYear()} ${siteConfig.site.author}`,
    },
  } as any,

  async buildEnd(site: SiteConfig) {
    const posts = await createContentLoader('posts/*.md', {
      excerpt: true,
      render: true,
    }).load()

    const listedPosts = posts
      .filter((p) => !p.frontmatter.excludeFromPosts)
      .sort(
        (a, b) =>
          new Date(b.frontmatter.date || 0).getTime() - new Date(a.frontmatter.date || 0).getTime()
      )

    const baseUrl = siteConfig.site.url.replace(/\/+$/, '')
    const itemsXml = listedPosts
      .map((post) => {
        const postUrl = `${baseUrl}${post.url.replace(/\.html$/, '')}`
        const pubDate = new Date(post.frontmatter.date || Date.now()).toUTCString()
        const desc = post.frontmatter.description || ''
        return `    <item>
      <title>${escapeXml(post.frontmatter.title || 'Untitled')}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid>${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`
      })
      .join('\n')

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.site.title)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(siteConfig.site.description)}</description>
    <language>en-gb</language>
    <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>
`
    await fs.writeFile(path.join(site.outDir, 'rss.xml'), rssXml, 'utf8')
  },
})
