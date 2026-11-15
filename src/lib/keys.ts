import { randomBytes } from "node:crypto"

/** No 0/O/1/l/I, so a key can be read out loud and typed */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ"
export const KEY_LENGTH = 8
export const KEY_RE = /^[23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ]{6,12}$/

/** A random public key for /l/{key}: 8 characters of a 54-symbol alphabet (~46 bits) */
export function newKey(length = KEY_LENGTH): string {
  const bytes = randomBytes(length * 2)
  let out = ""
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    const b = bytes[i]
    if (b < 216) out += ALPHABET[b % ALPHABET.length] // 216 = 4 × 54, rejection sampling keeps it uniform
  }
  return out.length === length ? out : newKey(length)
}
