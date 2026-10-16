import crypto from 'node:crypto'

/**
 * Verifies Outline's `Outline-Signature` header.
 * Supports both `t=<timestamp>,s=<hex>` (`HMAC(secret, "${t}.${rawBody}")`) and raw HMAC-SHA256 hex signatures.
 */
export function verifyOutlineSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false

  let timestamp = ''
  let signatureHex = signatureHeader.trim()

  if (signatureHeader.includes('s=')) {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => {
        const [k, v] = part.trim().split('=')
        return [k, v]
      })
    )
    timestamp = parts.t || ''
    signatureHex = parts.s || ''
  }

  const candidates = timestamp
    ? [`${timestamp}.${rawBody.toString('utf8')}`, rawBody]
    : [rawBody]

  for (const payload of candidates) {
    const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    if (
      digest.length === signatureHex.length &&
      crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHex))
    ) {
      return true
    }
  }
  return false
}
