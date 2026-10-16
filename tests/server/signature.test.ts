import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyOutlineSignature } from '../../scripts/server/signature.ts'

const SECRET = 'test-webhook-secret'
const body = Buffer.from(JSON.stringify({ event: 'documents.update' }))
const hmac = (payload: string | Buffer) => crypto.createHmac('sha256', SECRET).update(payload).digest('hex')

describe('verifyOutlineSignature', () => {
  it('accepts the `t=<timestamp>,s=<hex>` format signed over "<t>.<body>"', () => {
    const t = '1760000000'
    expect(verifyOutlineSignature(body, `t=${t},s=${hmac(`${t}.${body}`)}`, SECRET)).toBe(true)
  })

  it('accepts a timestamped header whose signature covers only the body', () => {
    expect(verifyOutlineSignature(body, `t=1,s=${hmac(body)}`, SECRET)).toBe(true)
  })

  it('accepts a raw hex signature', () => {
    expect(verifyOutlineSignature(body, hmac(body), SECRET)).toBe(true)
  })

  it('rejects missing, malformed, tampered or wrongly keyed signatures', () => {
    expect(verifyOutlineSignature(body, undefined, SECRET)).toBe(false)
    expect(verifyOutlineSignature(body, 'not-hex', SECRET)).toBe(false)
    expect(verifyOutlineSignature(Buffer.from('{"event":"x"}'), hmac(body), SECRET)).toBe(false)
    expect(verifyOutlineSignature(body, hmac(body), 'other-secret')).toBe(false)
  })
})
