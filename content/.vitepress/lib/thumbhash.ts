import fs from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ThumbnailHashImages } from '@nolebase/vitepress-plugin-thumbnail-hash/vite'

// `vite` isn't a direct dependency, so borrow its Plugin type from the wrapped plugin
type Plugin = ReturnType<typeof ThumbnailHashImages>
type ThumbHashMap = Record<string, unknown>

/**
 * Wraps `@nolebase/vitepress-plugin-thumbnail-hash`'s Vite plugin so that:
 * 1. Concurrent Vite client + SSR builds share a single execution promise instead of racing on `map.json`
 * 2. `.webp` images under `content/public/` are also ThumbHashed via `canvaskit-wasm` + `thumbhash`
 * 3. Every `"public/*"` entry in `map.json` is aliased without the `"public/"` prefix (e.g. `"attachments/..."`)
 *    before `configResolved` resolves, so `@nolebase/markdown-it-unlazy-img` finds `/attachments/...` URLs cleanly.
 */
export function createVitePaperThumbnailHashPlugin(publicDir: string): Plugin {
  const basePlugin = ThumbnailHashImages()
  const origConfigResolved = basePlugin.configResolved
  let sharedRunPromise: Promise<void> | null = null

  return {
    ...basePlugin,
    async configResolved(config) {
      if (!sharedRunPromise) {
        sharedRunPromise = (async () => {
          if (typeof origConfigResolved === 'function') {
            await origConfigResolved.call(this, config)
          }
          // `vitepress` is injected onto the resolved Vite config by VitePress itself
          const cacheDir = (config as unknown as { vitepress: { cacheDir: string } }).vitepress.cacheDir
          const mapPath = path.join(
            cacheDir,
            '@nolebase',
            'vitepress-plugin-thumbnail-hash',
            'thumbhashes',
            'map.json'
          )
          if (!existsSync(mapPath)) return
          const map = JSON.parse(await fs.readFile(mapPath, 'utf8')) as ThumbHashMap

          const hashedWebp = await hashWebpAttachments(path.join(publicDir, 'attachments'), map)
          const aliased = addPublicAliases(map)
          if (hashedWebp || aliased) {
            await fs.writeFile(mapPath, JSON.stringify(map, null, 2), 'utf8')
          }
        })()
      }
      await sharedRunPromise
    },
  }
}

/**
 * Hashes any `.webp` files in `content/public/attachments/` that are missing from `map`
 * (`@nolebase` only globs jpg/jpeg/png by default). Mutates `map`; returns whether anything changed.
 */
async function hashWebpAttachments(attachmentsDir: string, map: ThumbHashMap): Promise<boolean> {
  if (!existsSync(attachmentsDir)) return false
  const webpFiles = readdirSync(attachmentsDir).filter((f) => f.toLowerCase().endsWith('.webp'))
  if (webpFiles.length === 0) return false

  // Resolve `canvaskit-wasm` & `thumbhash` from the plugin's own dependency tree
  const pluginReq = createRequire(
    createRequire(import.meta.url).resolve('@nolebase/vitepress-plugin-thumbnail-hash')
  )
  const CanvasKitInit = (await import(pathToFileURL(pluginReq.resolve('canvaskit-wasm')).href)).default
  const { rgbaToThumbHash, thumbHashToDataURL } = await import(
    pathToFileURL(pluginReq.resolve('thumbhash')).href
  )
  const canvasKit = await CanvasKitInit()

  let changed = false
  for (const file of webpFiles) {
    const relKey = `public/attachments/${file}`
    if (map[relKey]) continue
    try {
      const buf = await fs.readFile(path.join(attachmentsDir, file))
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      const img = canvasKit.MakeImageFromEncoded(ab)
      if (!img) continue
      const origW = img.width()
      const origH = img.height()
      const scale = 100 / Math.max(origW, origH)
      const w = Math.round(origW * scale)
      const h = Math.round(origH * scale)
      const canvas = canvasKit.MakeCanvas(w, h)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      const pixels = ctx.getImageData(0, 0, w, h)
      const hashBin = rgbaToThumbHash(pixels.width, pixels.height, pixels.data)
      map[relKey] = {
        dataBase64: Buffer.from(hashBin).toString('base64'),
        dataUrl: await thumbHashToDataURL(hashBin),
        width: w,
        height: h,
        originalWidth: origW,
        originalHeight: origH,
        assetFileName: relKey,
        assetFullFileName: `content/${relKey}`,
      }
      changed = true
    } catch {
      // Ignore unreadable webp
    }
  }
  return changed
}

/**
 * Aliases every `public/*` key without its `public/` prefix, and every `.webp` key as `.webp.png`
 * (the markdown image renderer looks up local webp images under that name). Mutates `map`.
 */
export function addPublicAliases(map: ThumbHashMap): boolean {
  let changed = false
  for (const [key, val] of Object.entries(map)) {
    if (key.startsWith('public/')) {
      const publicAlias = key.slice('public/'.length)
      if (!(publicAlias in map)) {
        map[publicAlias] = val
        changed = true
      }
      if (publicAlias.endsWith('.webp') && !(`${publicAlias}.png` in map)) {
        map[`${publicAlias}.png`] = val
        changed = true
      }
    }
    if (key.endsWith('.webp') && !(`${key}.png` in map)) {
      map[`${key}.png`] = val
      changed = true
    }
  }
  return changed
}
