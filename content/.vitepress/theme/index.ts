import { h } from 'vue'
import { type Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { NolebaseHighlightTargetedHeading } from '@nolebase/vitepress-plugin-highlight-targeted-heading/client'
import { NolebaseInlineLinkPreviewPlugin } from '@nolebase/vitepress-plugin-inline-link-preview/client'
import { NolebaseUnlazyImg } from '@nolebase/vitepress-plugin-thumbnail-hash/client'
import '@nolebase/vitepress-plugin-enhanced-mark/client/style.css'
import '@nolebase/vitepress-plugin-highlight-targeted-heading/client/style.css'
import '@nolebase/vitepress-plugin-inline-link-preview/client/style.css'
import '@nolebase/vitepress-plugin-thumbnail-hash/client/style.css'
import PostHeader from './components/PostHeader.vue'
import ReadingProgress from './components/ReadingProgress.vue'
import PostFooter from './components/PostFooter.vue'
import PostList from './components/PostList.vue'
import Mermaid from './components/Mermaid.vue'
import MediaLightbox from './components/MediaLightbox.vue'
import SocialLinks from './components/SocialLinks.vue'
import { installCodeTabSlider } from './code-tab-slider.ts'
import { installDetailsAnimation } from './details-animation.ts'
import { installNavSnake } from './nav-snake.ts'
import { installReadingNav } from './reading-nav.ts'
import { installPageViewTransitions } from './view-transitions.ts'
import 'virtual:group-icons.css'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'layout-top': () => [h(NolebaseHighlightTargetedHeading), h(ReadingProgress)],
      'doc-before': () => h(PostHeader),
      'doc-footer-before': () => h(PostFooter),
      'layout-bottom': () => h(MediaLightbox),
    })
  },
  enhanceApp({ app, router }) {
    app.use(NolebaseInlineLinkPreviewPlugin)
    app.component('NolebaseUnlazyImg', NolebaseUnlazyImg)
    app.component('PostList', PostList)
    app.component('Mermaid', Mermaid)
    app.component('SocialLinks', SocialLinks)

    if (typeof document !== 'undefined') {
      const navSnake = installNavSnake()
      installPageViewTransitions(router, {
        onReady: () => navSnake.update(null, true),
        onFinished: () => navSnake.update(null, false),
      })
      installDetailsAnimation()
      installCodeTabSlider()
      installReadingNav(router)
    }
  },
} satisfies Theme
