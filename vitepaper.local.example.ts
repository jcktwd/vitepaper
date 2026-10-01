import type { DeepPartial, VitePaperConfig } from './vitepaper.config.ts'

/**
 * Copy this file to `vitepaper.local.ts` (which is gitignored) to customize
 * your personal blog instance without modifying tracked repository files.
 */
const localConfig: DeepPartial<VitePaperConfig> = {
  site: {
    title: 'My Technical Blog',
    logo: 'lucide:terminal',
    description: 'Notes on software engineering, infrastructure, and hardware.',
    intro: 'Welcome to my blog — notes on software engineering, infrastructure, and hardware.',
    url: 'https://blog.example.com',
    author: 'Your Name',
    postsPerPage: 5,
    socials: [
      { icon: 'github', link: 'https://github.com/your-username', label: 'GitHub' },
    ],
  },
  outline: {
    url: 'https://outline.example.com',
    collection: 'Blog',
    publishedFolder: 'Published',
    draftsFolder: 'Drafts',
  },
}

export default localConfig
