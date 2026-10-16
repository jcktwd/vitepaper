/**
 * One-off migration: rewrites legacy code-tab directives (`[tab-group: x, tab: y]`, `--- tab: y ---`, …)
 * in the Outline documents to `[!tab y] [!group x]` markers.
 *
 *   pnpm migrate:code-tabs           # dry run: prints every planned change, writes nothing
 *   pnpm migrate:code-tabs --apply   # applies them
 *
 * Each change is a separate `documents.update` in patch mode: Outline replaces just that directive line
 * (extended with following code lines until unique), leaving the rest of the document untouched.
 * `lastRevision` is checked on every write, so a document edited meanwhile fails with a conflict
 * instead of being overwritten. Afterwards each document is re-read to confirm the result.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../vitepaper.config.ts'
import { planCodeTabMigration } from './migrate/code-tabs.ts'
import {
  collectPostNodes,
  createOutlineClient,
  findFolderNode,
  resolveCollectionId,
  type OutlineDocNode,
  type OutlineDocument,
} from './sync/outline-api.ts'

type RevisionedDocument = OutlineDocument & { revision: number }

export async function migrateCodeTabs({ apply }: { apply: boolean }) {
  const client = createOutlineClient(config.outline.url, process.env.OUTLINE_API_KEY)
  const collectionId = await resolveCollectionId(client, config.outline.collection)
  const tree = await client.rpc<OutlineDocNode[]>('collections.documents', { id: collectionId })
  const folders = [config.outline.publishedFolder, config.outline.draftsFolder]
    .map((name) => findFolderNode(tree, name))
    .filter((node): node is OutlineDocNode => node !== null)
  const candidates = folders.flatMap((folder) => collectPostNodes(folder.children || []))

  console.log(`[Migrate code tabs] ${apply ? 'APPLYING' : 'Dry run'}: checking ${candidates.length} document(s)...\n`)
  let total = 0
  let failed = 0

  for (const { id } of candidates) {
    const doc = await client.rpc<RevisionedDocument>('documents.info', { id })
    const { edits, ambiguous } = planCodeTabMigration(doc.text || '')
    if (edits.length === 0 && ambiguous.length === 0) continue

    console.log(`■ ${doc.title} (${edits.length} block${edits.length === 1 ? '' : 's'}, revision ${doc.revision})`)
    for (const edit of edits) {
      console.log(indent(edit.oldDirective, '  - '))
      console.log(indent(edit.newDirective, '  + '))
    }
    for (const directive of ambiguous) {
      console.log(`  ! skipped, can't be matched uniquely: ${directive}`)
    }
    total += edits.length

    if (apply && edits.length > 0) {
      let revision = doc.revision
      let expected = doc.text
      try {
        for (const edit of edits) {
          const updated = await client.rpc<RevisionedDocument>('documents.update', {
            id: doc.id,
            editMode: 'patch',
            findText: edit.findText,
            text: edit.replaceText,
            lastRevision: revision,
          })
          revision = updated.revision
          expected = expected.replace(edit.findText, edit.replaceText)
        }
        const after = await client.rpc<RevisionedDocument>('documents.info', { id: doc.id })
        if (after.text === expected) {
          console.log(`  ✓ applied (now revision ${after.revision})`)
        } else {
          failed++
          console.log(`  ✗ applied, but the document differs from what was expected; check it in Outline`)
        }
      } catch (err) {
        failed++
        console.log(`  ✗ ${(err as Error).message}`)
      }
    }
    console.log()
  }

  console.log(
    total === 0
      ? '[Migrate code tabs] Nothing to migrate.'
      : apply
        ? `[Migrate code tabs] Done: ${total} block(s) across the documents above${failed ? `, ${failed} document(s) need attention` : ''}.`
        : `[Migrate code tabs] ${total} block(s) would change. Re-run with --apply to write them.`
  )
  return { total, failed }
}

function indent(text: string, prefix: string): string {
  return text.trimEnd().split('\n').map((line) => prefix + line).join('\n')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrateCodeTabs({ apply: process.argv.includes('--apply') })
    .then(({ failed }) => process.exit(failed ? 1 : 0))
    .catch((err) => {
      console.error('[Migrate code tabs] Error:', err.message || err)
      process.exit(1)
    })
}
