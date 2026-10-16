import type { MarkdownRenderer as MarkdownIt } from 'vitepress'

const VIDEO_URL_RE = /\.(?:mp4|m4v|webm|ogv|ogg|mov)(?:[?#]|$)/i
// Outline writes a video as `[<title> <width>x<height>](<src>)`; either dimension may be empty
const OUTLINE_VIDEO_LABEL_RE = /^(.*?)\s*(\d*)x(\d*)$/

export interface OutlineVideo {
  src: string
  title: string
  width?: number
  height?: number
}

/**
 * Recognises an Outline video export: a link whose label ends in `<width>x<height>` and whose
 * target is a video file (the sync has already swapped Outline's attachment URL for the
 * downloaded `/attachments/<id>.<ext>`). Returns null for anything else.
 */
export function parseOutlineVideo(label: string, href: string): OutlineVideo | null {
  if (!VIDEO_URL_RE.test(href)) return null
  const m = label.trim().match(OUTLINE_VIDEO_LABEL_RE)
  if (!m) return null
  const [, title, width, height] = m
  return {
    src: href,
    title: title.trim(),
    ...(Number(width) > 0 ? { width: Number(width) } : {}),
    ...(Number(height) > 0 ? { height: Number(height) } : {}),
  }
}

export function renderVideo(video: OutlineVideo, escapeHtml: (s: string) => string): string {
  const src = escapeHtml(video.src)
  const title = escapeHtml(video.title || 'Video')
  const size = [
    video.width ? ` width="${video.width}"` : '',
    video.height ? ` height="${video.height}"` : '',
  ].join('')
  return (
    `<figure class="vp-video">` +
    `<video src="${src}"${size} controls playsinline preload="metadata" aria-label="${title}">` +
    `<a href="${src}">${title}</a>` +
    `</video></figure>\n`
  )
}

/**
 * Turns paragraphs that contain nothing but an Outline video link into a `<video>` player,
 * at the size it was given in Outline.
 */
export function videosPlugin(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'outline-videos', (state) => {
    const tokens = state.tokens
    for (let i = 0; i + 2 < tokens.length; i++) {
      const [open, inline, close] = [tokens[i], tokens[i + 1], tokens[i + 2]]
      if (open.type !== 'paragraph_open' || inline.type !== 'inline' || close.type !== 'paragraph_close') continue

      const children = inline.children ?? []
      if (
        children.length !== 3 ||
        children[0].type !== 'link_open' ||
        children[1].type !== 'text' ||
        children[2].type !== 'link_close'
      ) continue

      const video = parseOutlineVideo(children[1].content, children[0].attrGet('href') ?? '')
      if (!video) continue

      const html = new state.Token('html_block', '', 0)
      html.content = renderVideo(video, md.utils.escapeHtml)
      html.block = true
      html.map = open.map
      tokens.splice(i, 3, html)
    }
  })
}
