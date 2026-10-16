import path from 'node:path'
import { createMarkdownRenderer, type MarkdownRenderer } from 'vitepress'
import { beforeAll, describe, expect, it } from 'vitest'
import { configureMarkdown } from '../../content/.vitepress/lib/markdown/index.ts'
import { parseOutlineVideo, renderVideo } from '../../content/.vitepress/lib/markdown/videos.ts'

let md: MarkdownRenderer
const render = (src: string) => md.render(src, { relativePath: 'posts/test.md' })

beforeAll(async () => {
  md = await createMarkdownRenderer(path.resolve('content'), { config: configureMarkdown })
})

describe('footnotes', () => {
  it('renders references as superscript numbers linking to a notes section', () => {
    const html = render('Measured at 32 kHz.[^1] Again.[^note]\n\n[^1]: Logic analyser.\n\n[^note]: Second.')
    expect(html).toMatch(/<sup class="footnote-ref"><a href="#fn1" id="fnref1">1<\/a><\/sup>/)
    expect(html).toMatch(/<a href="#fn2" id="fnref2">2<\/a>/)
    expect(html).toContain('<section class="footnotes" aria-label="Footnotes">')
    expect(html).toMatch(/<li id="fn1" class="footnote-item"><p>Logic analyser\. <a href="#fnref1" class="footnote-backref">/)
  })

  it('numbers repeated references to the same note with a sub-id', () => {
    const html = render('A[^x] and B[^x]\n\n[^x]: Shared.')
    expect(html).toMatch(/>1<\/a><\/sup>/)
    expect(html).toMatch(/>1:1<\/a><\/sup>/)
  })

  it('leaves undefined references as plain text', () => {
    expect(render('Dangling[^missing]')).toContain('Dangling[^missing]')
  })
})

describe('parseOutlineVideo', () => {
  it('reads title and size from an Outline video link', () => {
    expect(parseOutlineVideo('Demo clip 1280x720', '/attachments/abc.mp4')).toEqual({
      src: '/attachments/abc.mp4',
      title: 'Demo clip',
      width: 1280,
      height: 720,
    })
  })

  it('accepts missing dimensions', () => {
    expect(parseOutlineVideo('clip.webm x', '/attachments/abc.webm')).toEqual({ src: '/attachments/abc.webm', title: 'clip.webm' })
  })

  it('ignores links that are not videos or lack the size suffix', () => {
    expect(parseOutlineVideo('Demo 1280x720', '/attachments/abc.png')).toBeNull()
    expect(parseOutlineVideo('Download the clip', '/attachments/abc.mp4')).toBeNull()
    // Attachment the sync couldn't download: no file extension, so keep it a link
    expect(parseOutlineVideo('Demo 1280x720', '/api/attachments.redirect?id=1')).toBeNull()
  })
})

describe('renderVideo', () => {
  it('escapes attributes and falls back to a link', () => {
    const html = renderVideo({ src: '/a.mp4?x=1&y=2', title: 'A "quoted" <clip>', width: 640 }, md.utils.escapeHtml)
    expect(html).toBe(
      '<figure class="vp-video"><video src="/a.mp4?x=1&amp;y=2" width="640" controls playsinline preload="metadata" aria-label="A &quot;quoted&quot; &lt;clip&gt;">' +
        '<a href="/a.mp4?x=1&amp;y=2">A &quot;quoted&quot; &lt;clip&gt;</a></video></figure>\n'
    )
  })
})

describe('Outline video paragraphs', () => {
  it('become <video> players', () => {
    const html = render('Intro.\n\n[Screen recording 960x540](/attachments/abc.mp4)\n\nOutro.')
    expect(html).toContain('<figure class="vp-video"><video src="/attachments/abc.mp4" width="960" height="540" controls')
    expect(html).not.toContain('<p><a href="/attachments/abc.mp4"')
  })

  it('stay links when mixed with other text or inside code', () => {
    expect(render('See [clip 960x540](/attachments/abc.mp4) here.')).not.toContain('<video')
    expect(render('```md\n[clip 960x540](/attachments/abc.mp4)\n```')).not.toContain('<video')
  })
})
