import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * The site's font, from Google Fonts. Used both for the page stylesheet and, at build time, for
 * rendering OG images, so the social cards use the same typeface as the site.
 */
export const GOOGLE_FONTS_CSS_URL =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'

export interface FontFace {
  url: string
  weight: string
  style: string
}

/** TrueType font files listed in a Google Fonts CSS response */
export function parseGoogleFontsCss(css: string): FontFace[] {
  const faces: FontFace[] = []
  for (const [, block] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const url = block.match(/src:\s*url\(([^)]+)\)\s*format\(['"]truetype['"]\)/)?.[1]
    if (!url) continue
    faces.push({
      url,
      weight: block.match(/font-weight:\s*([^;]+);/)?.[1].trim() ?? '400',
      style: block.match(/font-style:\s*([^;]+);/)?.[1].trim() ?? 'normal',
    })
  }
  return faces
}

/**
 * Downloads the TrueType files for a Google Fonts CSS URL, caching them in `cacheDir`.
 *
 * The OG image renderer (resvg) can't read the woff2 that browsers get, but Google Fonts serves
 * TrueType to clients without a browser User-Agent, which is what Node's `fetch` sends. Falls back to
 * previously cached files when offline, and to no fonts (with a warning) when there are none.
 */
export async function loadGoogleFontBuffers(cssUrl: string, cacheDir: string): Promise<Buffer[]> {
  const fontDir = path.join(cacheDir, 'og-fonts')
  const cached = async () => {
    if (!existsSync(fontDir)) return []
    const files = (await fs.readdir(fontDir)).filter((f) => f.endsWith('.ttf'))
    return Promise.all(files.map((f) => fs.readFile(path.join(fontDir, f))))
  }

  try {
    const res = await fetch(cssUrl)
    if (!res.ok) throw new Error(`Google Fonts CSS request failed (${res.status})`)
    const faces = parseGoogleFontsCss(await res.text())
    if (faces.length === 0) throw new Error('Google Fonts returned no TrueType fonts')

    await fs.mkdir(fontDir, { recursive: true })
    return await Promise.all(
      faces.map(async ({ url, weight, style }) => {
        const file = path.join(fontDir, `${weight}-${style}-${path.basename(new URL(url).pathname)}`)
        if (existsSync(file)) return fs.readFile(file)
        const fontRes = await fetch(url)
        if (!fontRes.ok) throw new Error(`Font download failed (${fontRes.status}): ${url}`)
        const buffer = Buffer.from(await fontRes.arrayBuffer())
        await fs.writeFile(file, buffer)
        return buffer
      })
    )
  } catch (err) {
    const fallback = await cached()
    console.warn(
      `[og-images] Couldn't load fonts from Google Fonts (${(err as Error).message}); ` +
        (fallback.length > 0 ? `using ${fallback.length} cached font file(s).` : 'social cards will use the fallback font.')
    )
    return fallback
  }
}
