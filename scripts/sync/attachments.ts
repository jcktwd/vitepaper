import fs from 'node:fs/promises'
import path from 'node:path'
import type { OutlineClient } from './outline-api.ts'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
}

const ATTACHMENT_URL_RE = /\/api\/attachments\.redirect\?id=([0-9a-f-]{36})/gi

/**
 * Picks a file extension for a downloaded attachment from (in order) its `Content-Type`,
 * its `Content-Disposition` filename, or the final (post-redirect) URL path.
 */
export function attachmentExtension(contentType: string, disposition: string, finalUrl: string): string {
  const mime = contentType.split(';')[0].trim().toLowerCase()
  const dispExtMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?[^"';\r\n]+\.([a-z0-9]{2,5})["']?/i)
  const urlExtMatch = new URL(finalUrl).pathname.match(/\.([a-z0-9]{2,5})$/i)

  return (
    MIME_EXT[mime] ||
    (dispExtMatch ? dispExtMatch[1].toLowerCase() : '') ||
    (urlExtMatch ? urlExtMatch[1].toLowerCase() : '') ||
    'bin'
  )
}

/**
 * Downloads an Outline attachment into `attachmentsDir` (cached by attachment id) and returns its
 * public `/attachments/<file>` path, or the original Outline URL if the download fails.
 */
export async function downloadAttachment(
  client: OutlineClient,
  attachmentsDir: string,
  attachmentId: string
): Promise<string> {
  await fs.mkdir(attachmentsDir, { recursive: true })

  const existingFiles = await fs.readdir(attachmentsDir)
  const cached = existingFiles.find((f) => f.startsWith(`${attachmentId}.`))
  if (cached) {
    return `/attachments/${cached}`
  }

  const res = await client.fetchAttachment(attachmentId)
  if (!res.ok) {
    console.warn(`  [warn] Failed to download attachment ${attachmentId} (${res.status})`)
    return `/api/attachments.redirect?id=${attachmentId}`
  }

  const ext = attachmentExtension(
    res.headers.get('content-type') || '',
    res.headers.get('content-disposition') || '',
    res.url
  )
  const filename = `${attachmentId}.${ext}`
  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(path.join(attachmentsDir, filename), buffer)
  console.log(`  + Cached attachment: ${filename} (${(buffer.byteLength / 1024).toFixed(1)} KB)`)

  return `/attachments/${filename}`
}

/** Replaces every Outline attachment URL in `markdown` with the local path returned by `resolve`. */
export async function rewriteAttachments(
  markdown: string,
  resolve: (attachmentId: string) => Promise<string>
): Promise<string> {
  const matches = [...markdown.matchAll(ATTACHMENT_URL_RE)]
  if (matches.length === 0) return markdown

  const idToLocalPath = new Map<string, string>()
  for (const id of new Set(matches.map((m) => m[1]))) {
    idToLocalPath.set(id, await resolve(id))
  }

  return markdown.replace(ATTACHMENT_URL_RE, (full, id: string) => idToLocalPath.get(id) || full)
}
