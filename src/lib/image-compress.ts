'use client'

/** Hasil kompresi foto di sisi klien. */
export interface CompressResult {
  blob: Blob
  /** URL objek untuk preview (harus di-revoke setelah selesai). */
  previewUrl: string
  originalSize: number
  compressedSize: number
  width: number
  height: number
  /** true bila foto HEIC/HEIF (kamera HP mode "High efficiency") dikonversi dulu ke JPEG. */
  dariHeic?: boolean
  /** true bila kompresi gagal sehingga file asli dipakai apa adanya (fallback terakhir). */
  pakaiFileAsli?: boolean
}

const MAX_DIM_DEFAULT = 720
const QUALITY_DEFAULT = 0.72
/** Foto kamera HP modern bisa >20 MB — batas sanity sebelum diproses. */
const MAX_INPUT_SIZE = 40 * 1024 * 1024
/**
 * Batas ukuran untuk fallback "kirim file asli" — harus di bawah MAX_FOTO_SIZE
 * server (512 KB) supaya unggahan tetap diterima.
 */
const MAX_FALLBACK_SIZE = 450 * 1024

/** Brand ftyp yang menandakan kontainer HEIC/HEIF. */
const FTYP_HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'heif',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

function ascii(arr: Uint8Array, start: number, len: number): string {
  let s = ''
  for (let i = start; i < start + len && i < arr.length; i++) s += String.fromCharCode(arr[i])
  return s
}

/**
 * Deteksi HEIC/HEIF secara andal: cek MIME & ekstensi dulu, lalu magic bytes
 * (byte 4–7 = "ftyp", brand di byte 8–11). Penting karena beberapa kamera HP
 * (khususnya Samsung mode "High efficiency pictures") mengirim file .heic
 * dengan MIME kosong atau tidak standar.
 */
export async function adalahHeic(file: File): Promise<boolean> {
  const tipe = (file.type || '').toLowerCase()
  if (
    tipe === 'image/heic' ||
    tipe === 'image/heif' ||
    tipe === 'image/heic-sequence' ||
    tipe === 'image/heif-sequence'
  ) {
    return true
  }
  const nama = (file.name || '').toLowerCase()
  if (!tipe && (nama.endsWith('.heic') || nama.endsWith('.heif'))) return true
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (ascii(head, 4, 4) !== 'ftyp') return false
    return FTYP_HEIF_BRANDS.has(ascii(head, 8, 4).toLowerCase())
  } catch {
    return false
  }
}

/** Gambar sumber (bitmap/img) → canvas dengan sisi terpanjang maks maxDim. */
function sumberKeCanvas(
  sumber: CanvasImageSource,
  lebarAsli: number,
  tinggiAsli: number,
  maxDim: number
): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(lebarAsli, tinggiAsli))
  const width = Math.max(1, Math.round(lebarAsli * scale))
  const height = Math.max(1, Math.round(tinggiAsli * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Browser tidak mendukung kompresi gambar')
  ctx.drawImage(sumber, 0, 0, width, height)
  return canvas
}

/** Decode blob gambar dengan fallback berlapis agar kompatibel semua browser HP. */
async function decodeGambar(
  sumber: Blob
): Promise<{ sumberGambar: CanvasImageSource; width: number; height: number; bersihkan?: () => void }> {
  // Jalur 1 — createImageBitmap (mendukung EXIF orientation via opsi):
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(sumber, { imageOrientation: 'from-image' })
      return {
        sumberGambar: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        bersihkan: () => bitmap.close(),
      }
    }
  } catch {
    /* lanjut ke fallback <img> */
  }
  // Jalur 2 — elemen <img> (didukung semua browser sejak lama; orientasi EXIF
  // diterapkan otomatis oleh browser modern):
  const url = URL.createObjectURL(sumber)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('DECODE_GAGAL'))
      img.src = url
    })
    return { sumberGambar: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlobJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/** Bungkus blob jadi CompressResult tanpa kompresi (fallback file asli). */
function hasilFileAsli(file: File | Blob, dariHeic: boolean): CompressResult {
  const blob = file instanceof File ? file : file
  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    originalSize: blob.size,
    compressedSize: blob.size,
    width: 0,
    height: 0,
    dariHeic,
    pakaiFileAsli: true,
  }
}

/**
 * Kompres foto di browser SEBELUM diunggah agar tidak memberatkan
 * database/storage:
 * - HEIC/HEIF (kamera HP Samsung/iPhone mode "High efficiency pictures")
 *   dikonversi otomatis ke JPEG dulu (heic2any dimuat lazy hanya saat perlu)
 * - decode dengan fallback: createImageBitmap → elemen <img> → file asli
 * - sisi terpanjang maks `maxDim` px (default 720)
 * - keluaran JPEG kualitas `quality` (default 0.72) — tipikal 60–120 KB
 * - orientasi EXIF kamera diperbaiki otomatis
 * Melempar Error dengan pesan siap-tampil (toast) bila benar-benar gagal.
 */
export async function compressImageFile(
  file: File,
  opts?: { maxDim?: number; quality?: number }
): Promise<CompressResult> {
  const maxDim = opts?.maxDim ?? MAX_DIM_DEFAULT
  const quality = opts?.quality ?? QUALITY_DEFAULT

  if (file.size === 0) throw new Error('File foto kosong. Coba ambil selfie lagi.')
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error('Foto terlalu besar (lebih dari 40 MB). Coba ambil selfie ulang.')
  }

  // 1) HEIC/HEIF → konversi ke JPEG dulu (browser umumnya tidak bisa decode)
  let sumber: Blob = file
  let dariHeic = false
  if (await adalahHeic(file)) {
    try {
      const { default: heic2any } = await import('heic2any')
      const hasil = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
      sumber = Array.isArray(hasil) ? hasil[0] : hasil
      dariHeic = true
    } catch {
      throw new Error(
        'Foto berformat HEIC gagal dikonversi. Ubah setelan kamera HP ke format ' +
          'JPEG (matikan "High efficiency pictures") lalu foto ulang.'
      )
    }
  }

  // 2) Decode (dengan fallback) → canvas → JPEG
  try {
    const { sumberGambar, width, height, bersihkan } = await decodeGambar(sumber)
    try {
      const canvas = sumberKeCanvas(sumberGambar, width, height, maxDim)
      let blob = await toBlobJpeg(canvas, quality)
      if (!blob) blob = await toBlobJpeg(canvas, 0.5)
      if (!blob) throw new Error('TOBLOB_GAGAL')
      return {
        blob,
        previewUrl: URL.createObjectURL(blob),
        originalSize: file.size,
        compressedSize: blob.size,
        width: canvas.width,
        height: canvas.height,
        dariHeic,
      }
    } finally {
      bersihkan?.()
    }
  } catch {
    // 3) Fallback terakhir: kirim file asli apa adanya bila masih ringan —
    //    lebih baik absen terkirim daripada gagal total.
    if (sumber.size <= MAX_FALLBACK_SIZE) {
      return hasilFileAsli(sumber, dariHeic)
    }
    throw new Error(
      'Gagal memproses foto di browser ini. Coba foto ulang, atau gunakan ' +
        'browser lain (Chrome/Firefox terbaru).'
    )
  }
}

/** Format ukuran byte → teks ringkas ("86 KB", "2.4 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
