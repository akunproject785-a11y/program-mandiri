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
}

/**
 * Kompres foto di browser SEBELUM diunggah agar tidak memberatkan
 * database/storage:
 * - sisi terpanjang maks `maxDim` px (default 720)
 * - keluaran JPEG kualitas `quality` (default 0.72) — tipikal 60–120 KB
 * - orientasi EXIF kamera diperbaiki otomatis (createImageBitmap)
 */
export async function compressImageFile(
  file: File,
  opts?: { maxDim?: number; quality?: number }
): Promise<CompressResult> {
  const maxDim = opts?.maxDim ?? 720
  const quality = opts?.quality ?? 0.72

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Gagal membaca foto. Gunakan file gambar yang valid.')
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Browser tidak mendukung kompresi gambar')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
  if (!blob) throw new Error('Gagal mengompres foto. Coba foto lain.')

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    originalSize: file.size,
    compressedSize: blob.size,
    width,
    height,
  }
}

/** Format ukuran byte → teks ringkas ("86 KB", "2.4 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
