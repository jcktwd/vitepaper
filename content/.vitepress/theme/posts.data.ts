import { createContentLoader } from 'vitepress'

export interface PostItem {
  title: string
  url: string
  date: string
  updated?: string
  description: string
  icon?: string
  tags: string[]
  featured: boolean
  excludeFromPosts: boolean
  readingTime: string
}

declare const data: PostItem[]
export { data }

export default createContentLoader('posts/*.md', {
  includeSrc: true,
  transform(raw): PostItem[] {
    return raw
      .map(({ url, frontmatter, src }) => {
        const cleanBody = (src || '').replace(/^---[\s\S]*?---/, '').trim()
        const words = cleanBody ? cleanBody.split(/\s+/).length : 0
        const minutes = Math.max(1, Math.ceil(words / 200))

        return {
          title: frontmatter.title || 'Untitled',
          url,
          date: frontmatter.date ? new Date(frontmatter.date).toISOString() : new Date().toISOString(),
          updated: frontmatter.updated ? new Date(frontmatter.updated).toISOString() : undefined,
          description: frontmatter.description || '',
          icon: frontmatter.icon,
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
          featured: Boolean(frontmatter.featured),
          excludeFromPosts: Boolean(frontmatter.excludeFromPosts),
          readingTime: `${minutes} min read`,
        }
      })
      .filter((item) => !item.excludeFromPosts)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },
})
