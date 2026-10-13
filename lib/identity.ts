/** Domain samaran: NIS/NIP diubah menjadi email agar bisa dipakai Supabase Auth. */
export const PSEUDO_EMAIL_DOMAIN = 'lms.local'

/** NIS/NIP: huruf/angka saja, 3-30 karakter (sama dengan validasi di trigger database). */
const IDENTITY_PATTERN = /^[A-Za-z0-9]{3,30}$/

export function isValidIdentity(value: string): boolean {
  return IDENTITY_PATTERN.test(value.trim())
}

/** Selalu huruf kecil karena Supabase Auth menyimpan email dalam huruf kecil. */
export function toPseudoEmail(identityNumber: string): string {
  return `${identityNumber.trim().toLowerCase()}@${PSEUDO_EMAIL_DOMAIN}`
}
