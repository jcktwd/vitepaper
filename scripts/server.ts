import http from 'node:http'
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'
import { syncOutline } from './sync.ts'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const VP_DIR = path.join(ROOT_DIR, 'content', '.vitepress')
const DIST_DIR = path.join(VP_DIR, 'dist')
const DIST_NEXT_DIR = path.join(VP_DIR, 'dist-next')
const DIST_OLD_DIR = path.join(VP_DIR, 'dist-old')
const PORT = Number(process.env.PORT || 3000)
const WEBHOOK_DEBOUNCE_MS = 3000

/**
 * Creates a production `sirv` static handler with ETag, clean-URL (`.html`) resolution,
 * immutable caching for hashed Vite assets, and VitePress `404.html` fallback.
 * Re-instantiated after each zero-downtime webhook build swap so sirv's in-memory file map stays fresh.
 */
function createStaticHandler() {
  if (!existsSync(DIST_DIR)) {
    return (_req: http.IncomingMessage, res: http.ServerResponse) => {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Site is building, please refresh in a moment...')
    }
  }

  return sirv(DIST_DIR, {
    etag: true,
    extensions: ['html'],
    setHeaders(res, pathname) {
      if (pathname.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else if (pathname.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
    onNoMatch(_req, res) {
      const notFoundPath = path.join(DIST_DIR, '404.html')
      if (existsSync(notFoundPath)) {
        res.writeHead(404, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        })
        res.end(readFileSync(notFoundPath))
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('404 Not Found')
      }
    },
  })
}

let serveStatic = createStaticHandler()

/**
 * Verifies Outline's `Outline-Signature` header.
 * Supports both `t=<timestamp>,s=<hex>` (`HMAC(secret, "${t}.${rawBody}")`) and raw HMAC-SHA256 hex signatures.
 */
function verifyOutlineSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false

  let timestamp = ''
  let signatureHex = signatureHeader.trim()

  if (signatureHeader.includes('s=')) {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => {
        const [k, v] = part.trim().split('=')
        return [k, v]
      })
    )
    timestamp = parts.t || ''
    signatureHex = parts.s || ''
  }

  const candidates = timestamp
    ? [`${timestamp}.${rawBody.toString('utf8')}`, rawBody]
    : [rawBody]

  for (const payload of candidates) {
    const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    if (
      digest.length === signatureHex.length &&
      crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHex))
    ) {
      return true
    }
  }
  return false
}

let syncInProgress = false
let syncQueued = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Coalesces bursts of Outline webhook events (e.g. move + update + publish)
 * within a 3-second window before starting a sync and zero-downtime rebuild.
 */
function scheduleSyncAndBuild(reason: string) {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void triggerSyncAndBuild(reason)
  }, WEBHOOK_DEBOUNCE_MS)
}

async function triggerSyncAndBuild(reason: string) {
  if (syncInProgress) {
    syncQueued = true
    return
  }
  syncInProgress = true
  try {
    console.log(`[Webhook Server] Starting sync & zero-downtime build (${reason})...`)
    await syncOutline()

    // Clean any leftover staging folder and build into `DIST_NEXT_DIR`
    await fs.rm(DIST_NEXT_DIR, { recursive: true, force: true })
    const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
    await execFileAsync(pnpmBin, ['vitepress', 'build', 'content', '--outDir', DIST_NEXT_DIR], {
      cwd: ROOT_DIR,
    })

    // Atomically swap `dist-next` -> `dist` and refresh `sirv` file cache
    await fs.rm(DIST_OLD_DIR, { recursive: true, force: true })
    if (existsSync(DIST_DIR)) {
      await fs.rename(DIST_DIR, DIST_OLD_DIR)
    }
    await fs.rename(DIST_NEXT_DIR, DIST_DIR)
    serveStatic = createStaticHandler()
    await fs.rm(DIST_OLD_DIR, { recursive: true, force: true })

    console.log('[Webhook Server] Zero-downtime build swap completed successfully.')
  } catch (err) {
    console.error('[Webhook Server] Sync/Build error:', err)
  } finally {
    syncInProgress = false
    if (syncQueued) {
      syncQueued = false
      void triggerSyncAndBuild('queued-webhook')
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  // 1. Outline Webhook Endpoint: POST /api/webhook/outline
  if (req.method === 'POST' && url.pathname === '/api/webhook/outline') {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const rawBody = Buffer.concat(chunks)

    const secret = process.env.OUTLINE_WEBHOOK_SECRET
    if (secret) {
      const sigHeader = req.headers['outline-signature'] as string | undefined
      if (!verifyOutlineSignature(rawBody, sigHeader, secret)) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid Outline-Signature' }))
        return
      }
    }

    let eventName = 'manual'
    try {
      const parsed = JSON.parse(rawBody.toString('utf8'))
      eventName = parsed.event || 'unknown'
    } catch {
      // Ignore malformed JSON
    }

    // Respond immediately (<5ms) to satisfy Outline's 5000ms webhook timeout
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, event: eventName }))

    if (eventName.startsWith('documents.') || eventName === 'manual') {
      scheduleSyncAndBuild(`webhook:${eventName}`)
    }
    return
  }

  // 2. Healthcheck Endpoint: GET /api/health
  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', syncInProgress }))
    return
  }

  // 3. Static File Server via `sirv`
  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`[VitePaper Server] Listening on http://localhost:${PORT}`)
  console.log(`[VitePaper Server] Webhook endpoint: http://localhost:${PORT}/api/webhook/outline`)
})
