import { slugify } from './slugify.ts'

export interface OutlineDocNode {
  id: string
  title: string
  url: string
  children: OutlineDocNode[]
}

export interface OutlineDocument {
  id: string
  urlId: string
  title: string
  text: string
  icon?: string | null
  emoji?: string | null
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
  createdBy?: { name: string }
}

export interface OutlineClient {
  /** Calls an Outline RPC method (`POST /api/<method>`) and returns its `data` */
  rpc<T>(method: string, body?: Record<string, unknown>): Promise<T>
  /** Fetches an attachment (following Outline's redirect to storage) */
  fetchAttachment(attachmentId: string): Promise<Response>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createOutlineClient(outlineUrl: string, apiKey: string | undefined): OutlineClient {
  const baseUrl = outlineUrl.replace(/\/+$/, '')

  function requireApiKey(): string {
    if (!apiKey) {
      throw new Error('Missing OUTLINE_API_KEY environment variable. Set it in .env or environment.')
    }
    return apiKey
  }

  return {
    async rpc<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
      const res = await fetch(`${baseUrl}/api/${method}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${requireApiKey()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Outline API ${method} failed (${res.status}): ${errText}`)
      }

      const json = (await res.json()) as { data: T }
      return json.data
    },

    fetchAttachment(attachmentId: string): Promise<Response> {
      return fetch(`${baseUrl}/api/attachments.redirect?id=${attachmentId}`, {
        headers: { Authorization: `Bearer ${requireApiKey()}` },
        redirect: 'follow',
      })
    },
  }
}

export async function resolveCollectionId(client: OutlineClient, nameOrId: string): Promise<string> {
  if (UUID_RE.test(nameOrId)) return nameOrId

  const collections = await client.rpc<Array<{ id: string; name: string }>>('collections.list', {
    limit: 100,
  })
  const match = collections.find((c) => c.name.toLowerCase() === nameOrId.toLowerCase())
  if (!match) {
    const available = collections.map((c) => `"${c.name}"`).join(', ')
    throw new Error(`Collection "${nameOrId}" not found in Outline. Available: ${available}`)
  }
  return match.id
}

/** Depth-first search of the collection tree for a document matching `nameOrId` (case-insensitive title or id). */
export function findFolderNode(nodes: OutlineDocNode[], nameOrId: string): OutlineDocNode | null {
  const targetLower = nameOrId.toLowerCase()
  for (const node of nodes) {
    if (node.id.toLowerCase() === targetLower || node.title.trim().toLowerCase() === targetLower) {
      return node
    }
    const foundInChild = findFolderNode(node.children || [], nameOrId)
    if (foundInChild) return foundInChild
  }
  return null
}

export interface PostCandidate {
  id: string
  inheritedTags: string[]
}

/**
 * Flattens a document tree into post candidates. Every document is a candidate; documents with
 * children also act as folders whose slugified title is inherited as a tag by all descendants.
 */
export function collectPostNodes(nodes: OutlineDocNode[], inheritedTags: string[] = []): PostCandidate[] {
  const result: PostCandidate[] = []
  for (const node of nodes) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    result.push({ id: node.id, inheritedTags })
    if (hasChildren) {
      const folderTag = slugify(node.title)
      const nextTags = folderTag ? [...new Set([...inheritedTags, folderTag])] : inheritedTags
      result.push(...collectPostNodes(node.children, nextTags))
    }
  }
  return result
}
