import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export interface SocialLink {
  icon: string
  link: string
  label?: string
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<U>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P]
}

export interface VitePaperConfig {
  site: {
    /** Blog title shown in the navbar, homepage hero, browser tab, and RSS feed */
    title: string
    /**
     * Site logo & favicon. Accepts:
     * - An Iconify identifier (e.g. 'majesticons:door-exit', 'lucide:terminal')
     * - A public file path or URL (e.g. '/logo.svg')
     * - A theme-specific object ({ light: '/logo-light.svg', dark: '/logo-dark.svg' })
     */
    logo?: string | { light: string; dark: string }
    /** Short SEO description for meta tags and RSS */
    description: string
    /** Intro paragraph(s) rendered in the homepage hero section */
    intro: string
    /** Public canonical URL of the site */
    url: string
    /** Author name */
    author: string
    /** Number of recent posts shown on the homepage */
    postsPerPage: number
    /** Show estimated reading time on posts */
    showReadingTime: boolean
    /** Social icon links shown in the navbar and `<SocialLinks />` / `` `socials` `` blocks */
    socials: SocialLink[]
  }
  outline: {
    /** Base URL of your self-hosted Outline instance */
    url: string
    /** Outline Collection name (e.g. 'Blog') or UUID */
    collection: string
    /** Parent document title (e.g. 'Published') or UUID that triggers publishing */
    publishedFolder: string
    /** Parent document title (e.g. 'Drafts') or UUID used when running `pnpm sync:drafts` */
    draftsFolder: string
  }
}

function parseEnvSocials(raw?: string): SocialLink[] | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Also support comma-separated `icon:url` pairs, e.g. `github:https://github.com/user,mail:mailto:hi@example.com,rss:/rss.xml`
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const idx = entry.indexOf(':')
        return idx > 0
          ? { icon: entry.slice(0, idx).trim(), link: entry.slice(idx + 1).trim() }
          : null
      })
      .filter((x): x is SocialLink => x !== null)
  }
  return undefined
}

/**
 * Default blank/starter state (safe to commit to a public GitHub repository).
 * Personal customizations belong in `vitepaper.local.ts` (gitignored) or `.env`.
 */
const defaultConfig: VitePaperConfig = {
  site: {
    title: process.env.SITE_TITLE || 'VitePaper',
    logo: process.env.SITE_LOGO || 'lucide:book-open',
    description:
      process.env.SITE_DESCRIPTION ||
      'A minimalist VitePress blog powered by Outline Wiki, inspired by AstroPaper.',
    intro:
      process.env.SITE_INTRO ||
      'Welcome to VitePaper — a minimalist technical blog theme powered by Outline Wiki and VitePress, inspired by AstroPaper.',
    url: process.env.SITE_URL || 'https://example.com',
    author: process.env.SITE_AUTHOR || 'VitePaper Author',
    postsPerPage: Number(process.env.SITE_POSTS_PER_PAGE || 5),
    showReadingTime: true,
    socials: parseEnvSocials(process.env.SITE_SOCIALS) || [
      { icon: 'github', link: 'https://github.com/satnaing/astro-paper', label: 'GitHub' },
      { icon: 'rss', link: '/rss.xml', label: 'RSS Feed' },
    ],
  },

  outline: {
    url: process.env.OUTLINE_URL || 'https://outline.example.com',
    collection: process.env.OUTLINE_COLLECTION || 'Blog',
    publishedFolder: process.env.OUTLINE_PUBLISHED_FOLDER || 'Published',
    draftsFolder: process.env.OUTLINE_DRAFTS_FOLDER || 'Drafts',
  },
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localConfigPath = path.join(__dirname, 'vitepaper.local.ts')

let mergedConfig: VitePaperConfig = defaultConfig

if (existsSync(localConfigPath)) {
  const localMod = (await import(pathToFileURL(localConfigPath).href)) as {
    default?: DeepPartial<VitePaperConfig>
  }
  const overrides = localMod.default || {}
  mergedConfig = {
    site: {
      ...defaultConfig.site,
      ...(overrides.site || {}),
      socials: overrides.site?.socials ?? defaultConfig.site.socials,
    },
    outline: {
      ...defaultConfig.outline,
      ...(overrides.outline || {}),
    },
  }
}

export default mergedConfig
