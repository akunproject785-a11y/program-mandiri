import 'server-only'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

/** Peta pesan error Supabase Auth → pesan Indonesia yang ramah pengguna. */
export function authAdminErrorMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'Email sudah terdaftar'
  }
  if (m.includes('password') && m.includes('6 characters')) {
    return 'Password minimal 6 karakter'
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'Format email tidak valid'
  }
  if (m.includes('unable to update email') || m.includes('email address')) {
    return 'Email tidak dapat digunakan'
  }
  return 'Operasi akun gagal: ' + raw
}

/** Terjemahkan error supabase-js (pesan berantai) menjadi pesan tunggal. */
export function extractAuthError(e: unknown): string {
  if (e instanceof Error) return e.message
  const maybe = e as { message?: string } | null
  return maybe?.message ?? 'Terjadi kesalahan pada layanan autentikasi'
}

/**
 * Buat user Supabase Auth baru (service role) — email langsung terkonfirmasi.
 * Throw Error berpesan Indonesia bila gagal.
 */
export async function createAuthUser(input: {
  email: string
  password: string
  namaLengkap: string
}): Promise<string> {
  const admin = createSupabaseServiceClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { namaLengkap: input.namaLengkap },
  })
  if (error) throw new Error(authAdminErrorMessage(error.message))
  if (!data.user) throw new Error('Pembuatan akun gagal: user tidak dikembalikan')
  return data.user.id
}

/** Update email user auth (service role). */
export async function updateAuthUserEmail(authUserId: string, email: string): Promise<void> {
  const admin = createSupabaseServiceClient()
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    email,
    email_confirm: true,
  })
  if (error) throw new Error(authAdminErrorMessage(error.message))
}

/** Update password user auth (service role). */
export async function updateAuthUserPassword(authUserId: string, password: string): Promise<void> {
  const admin = createSupabaseServiceClient()
  const { error } = await admin.auth.admin.updateUserById(authUserId, { password })
  if (error) throw new Error(authAdminErrorMessage(error.message))
}

/** Hapus user auth (service role). */
export async function deleteAuthUser(authUserId: string): Promise<void> {
  const admin = createSupabaseServiceClient()
  const { error } = await admin.auth.admin.deleteUser(authUserId)
  if (error) throw new Error(authAdminErrorMessage(error.message))
}
