import { escapeXml } from './xml.ts'

export interface FeedItem {
  title: string
  /** Absolute URL */
  url: string
  date: string | Date
  description: string
}

export interface Feed {
  title: string
  description: string
  /** Canonical site URL without a trailing slash */
  baseUrl: string
  items: FeedItem[]
}

export function buildRssXml(feed: Feed): string {
  const itemsXml = feed.items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid>${escapeXml(item.url)}</guid>
      <pubDate>${new Date(item.date).toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.baseUrl)}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>en-gb</language>
    <atom:link href="${escapeXml(feed.baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>
`
}
