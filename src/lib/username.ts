/** Util username login — dipakai server & client. */

export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/

export const USERNAME_HINT = '3–30 karakter, huruf/angka/titik/titik-hubung/garis-bawah.'

/** Normalisasi: trim + lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Username otomatis dari prefix email: huruf non-[a-z0-9._-] dibuang. */
export function usernameFromEmail(email: string): string {
  return normalizeUsername(email.split('@')[0] ?? '').replace(/[^a-z0-9._-]/g, '')
}

/** Fallback bila prefix email kosong setelah sanitasi. */
export function fallbackUsername(): string {
  return `musyrif-${Math.random().toString(36).slice(2, 8)}`
}

/** Validasi username (sudah dinormalisasi) — null = valid, string = pesan error. */
export function validateUsername(raw: string): string | null {
  if (!USERNAME_RE.test(raw)) return `Username tidak valid: ${USERNAME_HINT}`
  if (raw.startsWith('.') || raw.startsWith('-') || raw.endsWith('.') || raw.endsWith('-')) {
    return 'Username tidak boleh diawali/diakhiri titik atau garis-hubung.'
  }
  return null
}
