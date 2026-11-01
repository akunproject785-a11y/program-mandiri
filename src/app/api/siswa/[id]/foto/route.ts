import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { mapSiswa, siswaInclude } from '@/app/api/_lib/shared'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

type RouteParams = { params: Promise<{ id: string }> }

const BUCKET = 'foto-siswa'
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Ambil path objek dari URL public bucket foto-siswa. */
function objectPathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length).split('?')[0] || null
}

/** POST /api/siswa/:id/foto — admin. FormData { file }.
 *  Upload foto ke Supabase Storage (bucket foto-siswa), hapus foto lama,
 *  simpan URL public ke kolom Siswa.fotoUrl. */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const siswa = await db.siswa.findUnique({ where: { id } })
    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Format permintaan tidak valid' }, { status: 400 })
    }
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File foto wajib diunggah' }, { status: 400 })
    }
    const ext = ALLOWED_MIME[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Format harus JPG, PNG, atau WebP' },
        { status: 400 }
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran foto maksimal 2 MB' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File kosong' }, { status: 400 })
    }

    const storage = createSupabaseServiceClient().storage
    const objectPath = `siswa/${siswa.id}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await storage
      .from(BUCKET)
      .upload(objectPath, buffer, {
        contentType: file.type,
        // Cache browser 1 tahun: path selalu unik per unggah (timestamp) dan foto
        // lama dihapus — isi foto tak berubah selama URL sama, jadi egress hemat.
        cacheControl: '31536000',
        upsert: false,
      })
    if (uploadError) {
      console.error('[siswa/:id/foto POST] upload error:', uploadError.message)
      return NextResponse.json({ error: 'Gagal mengunggah ke storage' }, { status: 500 })
    }

    const { data } = storage.from(BUCKET).getPublicUrl(objectPath)
    const fotoUrl = data.publicUrl

    // Hapus foto lama bila ada (di bucket yang sama)
    const oldPath = siswa.fotoUrl ? objectPathFromUrl(siswa.fotoUrl) : null
    if (oldPath) {
      await storage.from(BUCKET).remove([oldPath]).catch(() => {})
    }

    const updated = await db.siswa.update({
      where: { id: siswa.id },
      data: { fotoUrl },
      include: siswaInclude,
    })

    return NextResponse.json({ siswa: mapSiswa(updated) })
  } catch (e) {
    console.error('[siswa/:id/foto POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** DELETE /api/siswa/:id/foto — admin. Hapus foto dan kosongkan fotoUrl. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const { id } = await params

    const siswa = await db.siswa.findUnique({ where: { id } })
    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    const oldPath = siswa.fotoUrl ? objectPathFromUrl(siswa.fotoUrl) : null
    if (oldPath) {
      const storage = createSupabaseServiceClient().storage
      await storage.from(BUCKET).remove([oldPath]).catch(() => {})
    }

    const updated = await db.siswa.update({
      where: { id: siswa.id },
      data: { fotoUrl: null },
      include: siswaInclude,
    })
    return NextResponse.json({ siswa: mapSiswa(updated) })
  } catch (e) {
    console.error('[siswa/:id/foto DELETE]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
