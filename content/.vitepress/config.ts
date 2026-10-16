import fs from 'node:fs/promises'
import path from 'node:path'
import { transformHeadMeta } from '@nolebase/vitepress-plugin-meta/vitepress'
import tailwindcss from '@tailwindcss/vite'
import { groupIconVitePlugin } from 'vitepress-plugin-group-icons'
import {
  createContentLoader,
  defineConfigWithTheme,
  type DefaultTheme,
  type HeadConfig,
  type UserConfig,
} from 'vitepress'
import siteConfig from '../../vitepaper.config.ts'
import { resolveSiteLogo } from './lib/logo.ts'
import { configureMarkdown } from './lib/markdown/index.ts'
import { buildPostsActiveMatch, getOutlineNavItems } from './lib/nav.ts'
import { generateOgImages } from './lib/og-images.ts'
import { POSTS_DIR, PUBLIC_DIR } from './lib/paths.ts'
import { buildRssXml } from './lib/rss.ts'
import { renderSearchEntry } from './lib/search.ts'
import { toThemeSocialLinks } from './lib/socials.ts'
import { createVitePaperThumbnailHashPlugin } from './lib/thumbhash.ts'

/** Default theme config plus the custom keys read by the theme's <PostList /> */
export interface VitePaperThemeConfig extends DefaultTheme.Config {
  intro: string
  postsPerPage: number
}

type VitePlugins = NonNullable<NonNullable<UserConfig['vite']>['plugins']>

const baseUrl = siteConfig.site.url.replace(/\/+$/, '')
const { navLogo, faviconHref } = resolveSiteLogo(siteConfig.site.logo)
const outlineNavItems = getOutlineNavItems(POSTS_DIR)

export default defineConfigWithTheme<VitePaperThemeConfig>({
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
    ...(faviconHref ? [['link', { rel: 'icon', type: 'image/svg+xml', href: faviconHref }] satisfies HeadConfig] : []),
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
        href: `${baseUrl}/rss.xml`,
      },
    ],
  ],

  async transformHead(context) {
    const head = await transformHeadMeta({
      handleExcerpt: async (excerpt, ctx) => {
        const fmDesc = ctx.pageData.frontmatter?.description
        if (typeof fmDesc === 'string' && fmDesc.trim()) {
          return fmDesc.trim()
        }
        return excerpt || siteConfig.site.description
      },
    })([...context.head], context)
    return head ?? [...context.head]
  },

  vite: {
    // These plugins are typed against a newer Vite major than VitePress 1.x bundles; they work at runtime
    plugins: [tailwindcss(), createVitePaperThumbnailHashPlugin(PUBLIC_DIR), groupIconVitePlugin()] as unknown as VitePlugins,
    optimizeDeps: {
      exclude: [
        '@nolebase/vitepress-plugin-inline-link-preview/client',
        '@nolebase/vitepress-plugin-thumbnail-hash/client',
        '@nolebase/ui',
      ],
    },
    ssr: {
      noExternal: [
        '@nolebase/vitepress-plugin-inline-link-preview',
        '@nolebase/vitepress-plugin-highlight-targeted-heading',
        '@nolebase/vitepress-plugin-thumbnail-hash',
        '@nolebase/ui',
      ],
    },
  },

  markdown: {
    math: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    languageAlias: {
      asl: 'c',
      aml: 'c',
      conf: 'ini',
    },
    config: configureMarkdown,
  },

  themeConfig: {
    ...(navLogo ? { logo: navLogo } : {}),
    intro: siteConfig.site.intro,
    postsPerPage: siteConfig.site.postsPerPage,

    nav: [
      { text: 'Posts', link: '/posts', activeMatch: buildPostsActiveMatch(outlineNavItems) },
      { text: 'Tags', link: '/tags', activeMatch: '^/tags' },
      ...outlineNavItems,
    ],

    search: {
      provider: 'local',
      options: {
        miniSearch: {
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: {
              title: 8,
              titles: 5,
              text: 1,
            },
          },
        },
        _render: renderSearchEntry,
      },
    },

    socialLinks: toThemeSocialLinks(siteConfig.site.socials),

    footer: {
      message:
        'Published with <a href="https://www.getoutline.com/" target="_blank" rel="noopener">Outline</a> &amp; <a href="https://vitepress.dev/" target="_blank" rel="noopener">VitePress</a> • Theme inspired by <a href="https://github.com/satnaing/astro-paper" target="_blank" rel="noopener">AstroPaper</a>',
      copyright: `Copyright © ${new Date().getFullYear()} ${siteConfig.site.author}`,
    },
  },

  async buildEnd(site) {
    const posts = await createContentLoader('posts/*.md').load()

    const listedPosts = posts
      .filter((p) => !p.frontmatter.excludeFromPosts)
      .sort(
        (a, b) =>
          new Date(b.frontmatter.date || 0).getTime() - new Date(a.frontmatter.date || 0).getTime()
      )

    const rssXml = buildRssXml({
      title: siteConfig.site.title,
      description: siteConfig.site.description,
      baseUrl,
      items: listedPosts.map((post) => ({
        title: post.frontmatter.title || 'Untitled',
        url: `${baseUrl}${post.url.replace(/\.html$/, '')}`,
        date: post.frontmatter.date || Date.now(),
        description: post.frontmatter.description || '',
      })),
    })
    await fs.writeFile(path.join(site.outDir, 'rss.xml'), rssXml, 'utf8')

    await generateOgImages(site, posts, {
      baseUrl,
      siteTitle: siteConfig.site.title,
      author: siteConfig.site.author,
    })
  },
})
