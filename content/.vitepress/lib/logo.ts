export type SiteLogo = string | { light: string; dark: string }

/**
 * Resolves `site.logo` from `vitepaper.config.ts` into VitePress's navbar `logo`
 * and browser `<link rel="icon">` favicon.
 * Supports:
 * - Iconify identifiers (`collection:icon`, e.g. `'majesticons:door-exit'`)
 * - Public file paths (`'/logo.svg'`)
 * - Theme objects (`{ light: '...', dark: '...' }`)
 */
export function resolveSiteLogo(logo?: SiteLogo): {
  navLogo: SiteLogo | undefined
  faviconHref: string | undefined
} {
  if (!logo) return { navLogo: undefined, faviconHref: undefined }

  if (typeof logo === 'object') {
    return { navLogo: logo, faviconHref: logo.light }
  }

  // Check if it's an Iconify identifier (`prefix:name`, not starting with http/slash)
  if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(logo)) {
    const [prefix, name] = logo.split(':')
    return {
      navLogo: {
        light: `https://api.iconify.design/${prefix}/${name}.svg?color=%23e14a39`,
        dark: `https://api.iconify.design/${prefix}/${name}.svg?color=%23ff6b01`,
      },
      faviconHref: `https://api.iconify.design/${prefix}/${name}.svg?color=%23e14a39`,
    }
  }

  return { navLogo: logo, faviconHref: logo }
}
