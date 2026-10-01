<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

interface SocialLinkItem {
  icon: string | { svg: string }
  link: string
  ariaLabel?: string
}

const { theme } = useData()

const links = computed<SocialLinkItem[]>(() => theme.value.socialLinks || [])

const ICON_ALIASES: Record<string, string> = {
  rss: 'lucide:rss',
  mail: 'lucide:mail',
  email: 'lucide:mail',
  globe: 'lucide:globe',
  website: 'lucide:globe',
  twitter: 'simple-icons:x',
}

function getIconUrl(icon: string): string {
  const normalized = ICON_ALIASES[icon.toLowerCase()] || icon.toLowerCase()
  if (normalized.includes(':')) {
    const [prefix, name] = normalized.split(':')
    return `https://api.iconify.design/${prefix}/${name}.svg`
  }
  return `https://api.iconify.design/simple-icons/${normalized}.svg`
}

function getLabel(item: SocialLinkItem): string {
  if (item.ariaLabel) return item.ariaLabel
  if (typeof item.icon === 'string') {
    const raw = item.icon.includes(':') ? item.icon.split(':')[1] : item.icon
    if (raw.toLowerCase() === 'rss') return 'RSS'
    if (raw.toLowerCase() === 'github') return 'GitHub'
    if (raw.toLowerCase() === 'mail' || raw.toLowerCase() === 'email') return 'Email'
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  return 'Link'
}

function isExternal(link: string): boolean {
  return /^https?:\/\//i.test(link)
}

function isMailto(link: string): boolean {
  return /^mailto:/i.test(link)
}

function handleClick(event: MouseEvent, link: string) {
  if (isMailto(link)) {
    event.preventDefault()
    window.location.href = link
  }
}
</script>

<template>
  <div v-if="links.length" class="vp-social-links not-prose my-4 flex flex-wrap items-center gap-3">
    <a
      v-for="(item, index) in links"
      :key="index"
      :href="isMailto(item.link) ? '#contact' : item.link"
      :target="isExternal(item.link) ? '_blank' : undefined"
      :rel="isExternal(item.link) ? 'noopener noreferrer' : undefined"
      :aria-label="getLabel(item)"
      class="inline-flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--background-soft)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
      @click="handleClick($event, item.link)"
    >
      <span
        v-if="typeof item.icon === 'object' && item.icon.svg"
        class="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
        v-html="item.icon.svg"
      />
      <span
        v-else-if="typeof item.icon === 'string'"
        class="vp-mask-icon h-4 w-4 shrink-0"
        :style="{ '--icon-url': `url('${getIconUrl(item.icon)}')` }"
      />
      <span>{{ getLabel(item) }}</span>
    </a>
  </div>
</template>
