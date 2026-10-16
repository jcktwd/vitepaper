/** Static file types served as-is; any other path is a page (VitePress clean URLs have no extension) */
const STATIC_EXTENSIONS = new Set([
  'css', 'js', 'mjs', 'map', 'json', 'xml', 'txt', 'webmanifest',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'otf',
  'mp4', 'webm', 'ogv', 'mov', 'm4v', 'mp3',
  'pdf', 'zip', 'csv',
])

export const IMMUTABLE = 'public, max-age=31536000, immutable'
export const REVALIDATE = 'no-cache'

/**
 * `Cache-Control` for a request path, or null to leave the browser's default.
 *
 * - Hashed build assets (`/assets/…`) never change, so they're cached for a year.
 * - Pages must be revalidated (cheap thanks to ETags), so a deploy shows up straight away. sirv
 *   passes the request path, not the file it resolved, so clean URLs like `/posts/my-post` (served
 *   from `my-post.html`) have to be recognised as pages here.
 * - Other files (images, attachments, feeds) keep the default.
 */
export function cacheControlFor(pathname: string): string | null {
  if (pathname.startsWith('/assets/')) return IMMUTABLE
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
  const dot = lastSegment.lastIndexOf('.')
  const extension = dot === -1 ? '' : lastSegment.slice(dot + 1).toLowerCase()
  if (extension === 'html' || !STATIC_EXTENSIONS.has(extension)) return REVALIDATE
  return null
}
