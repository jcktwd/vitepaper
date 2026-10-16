/**
 * Builds the site from fixture Outline documents into `fixture-content/.vitepress/dist`, for the
 * built-site tests (`pnpm test:site`).
 *
 * `fixture-content/` is a copy of `content/` without your synced posts or attachments. It sits next
 * to `content/` so every relative import in the config still resolves. The fixture documents run
 * through the real sync code (frontmatter, cross-links, prev/next, escaping) before the build, so
 * this covers Outline export -> sync -> VitePress build -> rendered HTML without an Outline server.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtureDocs } from '../tests/fixtures/outline-docs.ts'
import { parseDocumentFrontmatter, serializePost } from './sync/frontmatter.ts'
import { assignPrevNext, resolveCrossDocumentLinksAndBacklinks } from './sync/links.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT_DIR = path.join(ROOT_DIR, 'content')
export const FIXTURE_DIR = path.join(ROOT_DIR, 'fixture-content')

const EXCLUDED = ['posts', 'public/attachments', '.vitepress/cache', '.vitepress/dist', '.vitepress/dist-next', '.vitepress/dist-old']
  .map((p) => path.join(CONTENT_DIR, p))

async function main() {
  // Build from the default config only, so local branding can't change the result
  process.env.VITEPAPER_IGNORE_LOCAL = '1'

  await fs.rm(FIXTURE_DIR, { recursive: true, force: true })
  await fs.cp(CONTENT_DIR, FIXTURE_DIR, {
    recursive: true,
    filter: (src) => !EXCLUDED.some((excluded) => src === excluded || src.startsWith(excluded + path.sep)),
  })

  const posts = fixtureDocs.map(({ doc, inheritedTags, isDraft }) =>
    parseDocumentFrontmatter(doc.text, doc, inheritedTags, { isDraft, defaultAuthor: 'Fixture Author' })
  )
  posts.sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())
  resolveCrossDocumentLinksAndBacklinks(posts)
  assignPrevNext(posts)

  const postsDir = path.join(FIXTURE_DIR, 'posts')
  await fs.mkdir(postsDir, { recursive: true })
  for (const post of posts) {
    await fs.writeFile(path.join(postsDir, `${post.slug}.md`), serializePost(post), 'utf8')
  }
  console.log(`[fixture-site] Wrote ${posts.length} fixture posts; building...`)

  const { build } = await import('vitepress')
  await build(FIXTURE_DIR)
  console.log(`[fixture-site] Built ${path.relative(ROOT_DIR, path.join(FIXTURE_DIR, '.vitepress', 'dist'))}`)
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('[fixture-site] Build failed:', err)
    process.exit(1)
  }
)
