import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VITEPRESS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const CONTENT_DIR = path.resolve(VITEPRESS_DIR, '..')
export const POSTS_DIR = path.join(CONTENT_DIR, 'posts')
export const PUBLIC_DIR = path.join(CONTENT_DIR, 'public')
