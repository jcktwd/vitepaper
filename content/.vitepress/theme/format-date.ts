/**
 * A post date as shown on cards and post headers ("1 Oct 2026"), in the site's timezone.
 *
 * The timezone is fixed rather than the reader's, so the day the build prints (in the server's zone)
 * is the day the browser prints when it hydrates: an evening post would otherwise change date, and
 * Vue would report the mismatch.
 */
export function formatPostDate(iso: string | undefined, timeZone: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone })
}
