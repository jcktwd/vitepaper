/**
 * Normalizes Outline ProseMirror Markdown serialization quirks (inline code + bold) and
 * converts Outline's resized-image titles into `@mdit/plugin-img-size` syntax.
 */
export function normalizeOutlineMarkdown(src: string): string {
  return (
    src
      .replace(/\*\*`\*\*([^`\n]+)\*\*`\*\*/g, '`$1`')
      .replace(/`\*\*([^`\n]+)\*\*`/g, '**`$1`**')
      .replace(/`([^`\n]+)`{2}\*([^*\n]+)\*`/g, '`$1$2`')
      // Outline stores resized image dimensions in the Markdown image title: ![alt](url " =360x240")
      // Convert to legacyImgSize syntax (![alt](url =360x240)) so @mdit/plugin-img-size sets width/height
      // and @mdit/plugin-figure uses the alt text for <figcaption>.
      .replace(
        /(!\[[^\]]*\]\([^)\s"]+)[ \t]+"\s*(?:source=\S+\s*)?(?:(?:right-50|left-50|full-width)\s*)?(=\d*%?x\d*%?)\s*"\)/g,
        '$1 $2)'
      )
  )
}
