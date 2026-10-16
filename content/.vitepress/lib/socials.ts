import type { DefaultTheme } from 'vitepress'
import type { SocialLink } from '../../../vitepaper.config.ts'

const MAIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'
const RSS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>'

/** Maps `site.socials` to VitePress `socialLinks`, supplying icons VitePress doesn't ship (mail, RSS). */
export function toThemeSocialLinks(socials: SocialLink[]): DefaultTheme.SocialLink[] {
  return socials.map((item) => {
    const iconLower = typeof item.icon === 'string' ? item.icon.toLowerCase() : ''
    const isMail = iconLower === 'mail' || iconLower === 'email'
    const isRss = iconLower === 'rss'

    const icon: DefaultTheme.SocialLinkIcon = isMail
      ? { svg: MAIL_SVG }
      : isRss
        ? { svg: RSS_SVG }
        : (item.icon as DefaultTheme.SocialLinkIcon)

    return {
      icon,
      link: item.link,
      ariaLabel: item.label || (isMail ? 'Email' : isRss ? 'RSS Feed' : item.icon),
    }
  })
}
