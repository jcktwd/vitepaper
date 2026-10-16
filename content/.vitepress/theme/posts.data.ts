import { createContentLoader } from 'vitepress'
import { toPostItems, type PostItem } from './post-cards.ts'

export type { PostItem }

declare const data: PostItem[]
export { data }

export default createContentLoader('posts/*.md', {
  includeSrc: true,
  transform: (raw) => toPostItems(raw),
})
