import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { toStrOrNull } from '@/app/api/_lib/shared'
import {
  ALLOWED_FOTO_MIME,
  BUCKET_ABSENSI,
  MAX_FOTO_SIZE,
  mapAbsensi,
  objectPathFromUrl,
  wibNow,
} from '../_lib'

/** Pastikan user adalah musyrif; return musyrifId atau response error. */
function guardMusyrif(role: string, musyrifId?: string) {
  if (role !== 'musyrif' || !musyrifId) {
    return NextResponse.json(
      { error: 'Hanya musyrif yang memiliki absensi' },
      { status: 403 }
    )
  }
  return null
}

/** GET /api/absensi/musyrif — riwayat absensi (30 terakhir) + absen hari ini (WIB). */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const guard = guardMusyrif(auth.user.role, auth.user.musyrifId)
    if (guard) return guard
    const musyrifId = auth.user.musyrifId as string

    const items = await db.absensiMusyrif.findMany({
      where: { musyrifId },
      orderBy: [{ tanggal: 'desc' }, { jam: 'desc' }],
      take: 30,
      include: { musyrif: { select: { namaLengkap: true } } },
    })
    const { tanggal } = wibNow()
    const hariIniRow = items.find((i) => i.tanggal === tanggal) ?? null

    return NextResponse.json({
      tanggalServer: tanggal,
      hariIni: hariIniRow ? mapAbsensi(hariIniRow) : null,
      items: items.map(mapAbsensi),
    })
  } catch (e) {
    console.error('[absensi/musyrif GET]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * POST /api/absensi/musyrif — FormData { file, keterangan? }.
 * Foto selfie SUDAH dikompres di browser (maks 720px, JPEG) — server menolak > 512 KB.
 * Satu absen per hari: absen ulang menimpa record (foto lama dihapus dari storage)
 * dan status kembali PENDING.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response
    const guard = guardMusyrif(auth.user.role, auth.user.musyrifId)
    if (guard) return guard
    const musyrifId = auth.user.musyrifId as string

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Format permintaan tidak valid' }, { status: 400 })
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Foto selfie wajib diunggah' }, { status: 400 })
    }
    const ext = ALLOWED_FOTO_MIME[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Format foto harus JPG, PNG, atau WebP' },
        { status: 400 }
      )
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File foto kosong' }, { status: 400 })
    }
    if (file.size > MAX_FOTO_SIZE) {
      return NextResponse.json(
        { error: 'Foto terlalu besar (maksimal 512 KB setelah kompresi)' },
        { status: 400 }
      )
    }
    const keterangan = toStrOrNull(form.get('keterangan'))

    const { tanggal, jam } = wibNow()
    const storage = createSupabaseServiceClient().storage

    // Upload foto ke Storage (DB hanya menyimpan URL — hemat database)
    const objectPath = `absensi/${musyrifId}/${tanggal}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await storage
      .from(BUCKET_ABSENSI)
      .upload(objectPath, buffer, {
        contentType: file.type,
        // Cache browser 1 tahun: path unik per unggah (tanggal+timestamp) dan isi
        // selfie tidak pernah berubah selama URL sama — egress hemat besar saat
        // admin meninjau foto absen berulang kali.
        cacheControl: '31536000',
        upsert: false,
      })
    if (uploadError) {
      console.error('[absensi/musyrif POST] upload error:', uploadError.message)
      return NextResponse.json({ error: 'Gagal mengunggah foto ke storage' }, { status: 500 })
    }
    const { data } = storage.from(BUCKET_ABSENSI).getPublicUrl(objectPath)
    const fotoUrl = data.publicUrl

    // Upsert: bila sudah absen hari ini, hapus foto lama lalu timpa record
    const existing = await db.absensiMusyrif.findUnique({
      where: { musyrifId_tanggal: { musyrifId, tanggal } },
    })
    if (existing?.fotoUrl) {
      const oldPath = objectPathFromUrl(existing.fotoUrl)
      if (oldPath) await storage.from(BUCKET_ABSENSI).remove([oldPath]).catch(() => {})
    }

    const saved = await db.absensiMusyrif.upsert({
      where: { musyrifId_tanggal: { musyrifId, tanggal } },
      create: { musyrifId, tanggal, jam, fotoUrl, keterangan, status: 'PENDING' },
      update: {
        jam,
        fotoUrl,
        keterangan,
        status: 'PENDING',
        catatanAdmin: null,
        diputusOleh: null,
        diputusPada: null,
      },
      include: { musyrif: { select: { namaLengkap: true } } },
    })

    return NextResponse.json(
      { absensi: mapAbsensi(saved), tanggalServer: tanggal },
      { status: existing ? 200 : 201 }
    )
  } catch (e) {
    console.error('[absensi/musyrif POST]', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
