import { defineComponent, h } from 'vue'
import { useData, type Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import PostHeader from './components/PostHeader.vue'
import PostList from './components/PostList.vue'
import Mermaid from './components/Mermaid.vue'
import SocialLinks from './components/SocialLinks.vue'
import './style.css'

const PostBacklinks = defineComponent({
  name: 'PostBacklinks',
  setup() {
    const { frontmatter } = useData()
    return () => {
      const backlinks = frontmatter.value.backlinks as
        | Array<{ title: string; link: string; icon?: string }>
        | undefined
      if (!Array.isArray(backlinks) || backlinks.length === 0) return null

      return h(
        'aside',
        {
          class:
            'not-prose mt-10 mb-4 rounded-md border border-dashed border-border bg-background-soft/60 p-4',
        },
        [
          h(
            'div',
            {
              class:
                'mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground',
            },
            'Referenced In'
          ),
          h(
            'ul',
            { class: 'flex flex-wrap gap-x-5 gap-y-2' },
            backlinks.map((item) =>
              h('li', { key: item.link }, [
                h(
                  'a',
                  {
                    href: item.link,
                    class:
                      'inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-dashed decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent',
                  },
                  [
                    item.icon ? h('span', null, item.icon) : null,
                    h('span', null, item.title),
                  ]
                ),
              ])
            )
          ),
        ]
      )
    }
  },
})

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => h(PostHeader),
      'doc-footer-before': () => h(PostBacklinks),
    })
  },
  enhanceApp({ app }) {
    app.component('PostList', PostList)
    app.component('Mermaid', Mermaid)
    app.component('SocialLinks', SocialLinks)
  },
} satisfies Theme
