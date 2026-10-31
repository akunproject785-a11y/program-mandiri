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
 * Cache profil per instance serverless (TTL 60 detik) — menghemat 2 query DB
 * (Admin + Musyrif) pada setiap request API. Profil jarang berubah; perubahan
 * nama/role paling lambat terlihat dalam 60 detik. Profil NULL (belum terhubung)
 * TIDAK di-cache agar akun yang baru dibuat admin langsung bisa login.
 */
type ProfilCacheEntry = { at: number; profil: SessionUser | null }
const PROFIL_TTL_MS = 60_000
const PROFIL_CACHE_MAX = 500
const profilCache = new Map<string, ProfilCacheEntry>()

async function cariProfil(authUserId: string): Promise<SessionUser | null> {
  const hit = profilCache.get(authUserId)
  if (hit && Date.now() - hit.at < PROFIL_TTL_MS) return hit.profil

  const [admin, musyrif] = await Promise.all([
    db.admin.findUnique({ where: { authUserId } }),
    db.musyrif.findUnique({ where: { authUserId } }),
  ])

  let profil: SessionUser | null = null
  if (admin) profil = { id: admin.id, name: admin.name, role: 'admin' }
  else if (musyrif)
    profil = {
      id: musyrif.id,
      name: musyrif.namaLengkap,
      role: 'musyrif',
      musyrifId: musyrif.id,
    }

  if (profil) {
    if (profilCache.size >= PROFIL_CACHE_MAX) profilCache.clear()
    profilCache.set(authUserId, { at: Date.now(), profil })
  }
  return profil
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

    return await cariProfil(data.user.id)
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
