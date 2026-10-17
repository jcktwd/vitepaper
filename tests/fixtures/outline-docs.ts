import type { OutlineDocument } from '../../scripts/sync/outline-api.ts'

/** A fake Outline document, as the sync would receive it, plus where it sits in the collection */
export interface FixtureDoc {
  doc: OutlineDocument
  inheritedTags: string[]
  isDraft?: boolean
}

function doc(id: number, title: string, publishedAt: string, text: string): OutlineDocument {
  const hex = String(id).padStart(12, '0')
  return {
    id: `00000000-0000-4000-8000-${hex}`,
    urlId: `fixture${id}`,
    title,
    text,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    publishedAt,
  }
}

const F = '```'

/**
 * The fixture blog the built-site tests check. Dates are chosen so the draft is the newest
 * document, which a listing bug would put at the top.
 */
export const fixtureDocs: FixtureDoc[] = [
  {
    inheritedTags: [],
    doc: doc(
      1,
      'Featured Teardown',
      '2026-05-01T09:00:00.000Z',
      [
        `${F}yaml`,
        'featured: true',
        'tags: [hardware]',
        F,
        '',
        'A teardown of a Vec<String> parser that prints {{ 1 + 1 }} literally.',
        '',
        'See [Linux Notes](/doc/linux-notes-fixture2) and <https://example.com/autolink>.',
        '',
        '| Pin | Notes |',
        '| --- | --- |',
        '| 1 | first<br>second |',
        '',
        'Measured at 32 kHz.[^1]',
        '',
        // A component rendered inside a paragraph, right before the footnotes: invalid nesting here made
        // Vue drop the footnotes on hydration
        '`integration: socials`',
        '',
        '[^1]: With a logic analyser.',
      ].join('\n')
    ),
  },
  {
    inheritedTags: ['linux'],
    doc: doc(
      2,
      'Linux Notes',
      '2026-04-01T09:00:00.000Z',
      [`${F}yaml`, 'tags: [hardware]', F, '', 'Notes about Linux, with maths: $a^2 + b^2 = c^2$.', '', '$$', '\\int_0^1 x\\,dx = \\frac{1}{2}', '$$'].join('\n')
    ),
  },
  {
    inheritedTags: ['linux'],
    doc: doc(3, 'Older Post', '2026-03-01T09:00:00.000Z', 'An older post.'),
  },
  {
    inheritedTags: [],
    isDraft: true,
    doc: doc(4, 'Secret Draft', '2026-06-01T09:00:00.000Z', [`${F}yaml`, 'tags: [secret]', 'featured: true', F, '', 'Not public yet.'].join('\n')),
  },
  {
    inheritedTags: [],
    doc: doc(
      5,
      'About Me',
      '2026-01-01T09:00:00.000Z',
      [`${F}yaml`, 'nav: About', 'excludeFromPosts: true', 'tags: [meta]', F, '', 'About this blog.'].join('\n')
    ),
  },
]
