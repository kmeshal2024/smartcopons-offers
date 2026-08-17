/**
 * Shared shopping-list links.
 *
 * The id must be unguessable, because it is the ONLY thing protecting the list —
 * there are no accounts. A sequential id would let anyone walk other households'
 * shopping lists, so this is CSPRNG-derived and never derived from a counter, a
 * timestamp, or the device id.
 *
 * 16 chars of base58-ish alphabet ≈ 93 bits. Well past the 10-char floor, and the
 * DB carries a CHECK constraint on length as a backstop.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const ID_LENGTH = 16

export function newListId(): string {
  const bytes = new Uint8Array(ID_LENGTH)

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    // Never expected in a browser; refuse rather than silently downgrading to
    // Math.random(), which is not a CSPRNG and would make ids guessable.
    throw new Error('Secure random unavailable — cannot mint a shareable list id')
  }

  // Modulo bias across a 57-char alphabet on 256 values is ~0.4% — irrelevant at
  // 93 bits of entropy, and avoiding it would cost a rejection loop for nothing.
  //
  // Indexed rather than iterated: tsconfig targets ES5-era downlevel iteration,
  // so `for (const b of bytes)` needs --downlevelIteration.
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export function listPath(id: string): string {
  return `/list/${id}`
}

export function listUrl(id: string): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://sa.smartcopons.com'
  return `${base}${listPath(id)}`
}
