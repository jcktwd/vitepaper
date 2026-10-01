import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import PostHeader from './components/PostHeader.vue'
import PostList from './components/PostList.vue'
import Mermaid from './components/Mermaid.vue'
import SocialLinks from './components/SocialLinks.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => h(PostHeader),
    })
  },
  enhanceApp({ app }) {
    app.component('PostList', PostList)
    app.component('Mermaid', Mermaid)
    app.component('SocialLinks', SocialLinks)
  },
} satisfies Theme
