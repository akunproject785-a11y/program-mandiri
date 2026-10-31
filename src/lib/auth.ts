import 'server-only'
import { db } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SessionUser = {
  id: string
  name: string
  role: 'admin' | 'musyrif'
  musyrifId?: string
}

/**
 * Sesi = Supabase Auth (JWT pada cookie sb-*). Profil & role dicari dari tabel
 * Admin/Musyrif berdasarkan authUserId (id auth.users). Return null bila belum
 * login / profil tidak ditemukan.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    const authUserId = data.user.id

    const [admin, musyrif] = await Promise.all([
      db.admin.findUnique({ where: { authUserId } }),
      db.musyrif.findUnique({ where: { authUserId } }),
    ])

    if (admin) return { id: admin.id, name: admin.name, role: 'admin' }
    if (musyrif) {
      return {
        id: musyrif.id,
        name: musyrif.namaLengkap,
        role: 'musyrif',
        musyrifId: musyrif.id,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Guard untuk endpoint yang wajib login */
export async function requireAuth() {
  const user = await getSessionUser()
  if (!user) {
    return {
      user: null,
      response: Response.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 }),
    }
  }
  return { user, response: null }
}

/** Guard untuk endpoint khusus admin */
export async function requireAdmin() {
  const user = await getSessionUser()
  if (!user) {
    return {
      user: null,
      response: Response.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 }),
    }
  }
  if (user.role !== 'admin') {
    return {
      user: null,
      response: Response.json(
        { error: 'Hanya admin yang dapat mengakses fitur ini' },
        { status: 403 }
      ),
    }
  }
  return { user, response: null }
}
