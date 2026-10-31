'use client'

/**
 * Section Absen (musyrif): absen kehadiran harian dengan foto selfie.
 * - Foto DIKOMPRES otomatis di browser (maks 720px, JPEG ±60–120 KB) sebelum
 *   diunggah — database hanya menyimpan URL foto, berkasnya di Supabase Storage.
 * - Satu absen per hari; absen ulang pada hari yang sama menimpa data lama dan
 *   status kembali "Menunggu ACC".
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Clock,
  History,
  ImageUp,
  Images,
  RotateCcw,
  Send,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { compressImageFile, formatBytes, type CompressResult } from '@/lib/image-compress'
import { formatTanggalIndo, hariFromTanggal } from '@/lib/format'
import type { AbsensiMusyrifItem, UserInfo } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, LoadingBlock, SectionHeader } from '@/components/dashboard/ui-helpers'
import { cn } from '@/lib/utils'

/** Badge status absensi (dipakai juga di section admin). */
export function StatusAbsensiBadge({ status }: { status: AbsensiMusyrifItem['status'] }) {
  if (status === 'ACC') {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3" /> ACC
      </Badge>
    )
  }
  if (status === 'TOLAK') {
    return (
      <Badge variant="destructive">
        <X className="h-3 w-3" /> Ditolak
      </Badge>
    )
  }
  return (
    <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
      <Clock className="h-3 w-3" /> Menunggu ACC
    </Badge>
  )
}

interface AbsenResponse {
  tanggalServer: string
  hariIni: AbsensiMusyrifItem | null
  items: AbsensiMusyrifItem[]
}

export default function AbsensiSection({ user }: { user: UserInfo }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AbsenResponse | null>(null)

  // Foto terpilih (sudah dikompres) menunggu dikirim
  const [pending, setPending] = useState<CompressResult | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [keterangan, setKeterangan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lihatFoto, setLihatFoto] = useState<string | null>(null)

  const kameraRef = useRef<HTMLInputElement>(null)
  const galeriRef = useRef<HTMLInputElement>(null)
  const previewUrlLama = useRef<string | null>(null)

  const muat = useCallback(() => {
    setLoading(true)
    api<AbsenResponse>('/api/absensi/musyrif')
      .then(setData)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    muat()
  }, [muat])

  // Bersihkan URL preview saat unmount
  useEffect(() => {
    return () => {
      if (previewUrlLama.current) URL.revokeObjectURL(previewUrlLama.current)
    }
  }, [])

  const terapkanFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG/PNG/WebP).')
      return
    }
    setCompressing(true)
    try {
      const hasil = await compressImageFile(file)
      if (previewUrlLama.current) URL.revokeObjectURL(previewUrlLama.current)
      previewUrlLama.current = hasil.previewUrl
      setPending(hasil)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCompressing(false)
    }
  }

  const kirimAbsen = async () => {
    if (!pending) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', new File([pending.blob], 'selfie.jpg', { type: 'image/jpeg' }))
      if (keterangan.trim()) fd.append('keterangan', keterangan.trim())
      const res = await fetch('/api/absensi/musyrif', { method: 'POST', body: fd })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Gagal mengirim absensi')
      toast.success('Absensi terkirim', {
        description: 'Menunggu verifikasi admin.',
      })
      if (previewUrlLama.current) {
        URL.revokeObjectURL(previewUrlLama.current)
        previewUrlLama.current = null
      }
      setPending(null)
      setKeterangan('')
      muat()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const batalPilih = () => {
    if (previewUrlLama.current) {
      URL.revokeObjectURL(previewUrlLama.current)
      previewUrlLama.current = null
    }
    setPending(null)
    setKeterangan('')
  }

  const hemat =
    pending && pending.originalSize > 0
      ? Math.max(0, Math.round((1 - pending.compressedSize / pending.originalSize) * 100))
      : 0

  const hariIni = data?.hariIni ?? null
  const riwayat = data?.items ?? []

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Absen Musyrif"
        description="Absen kehadiran harian dengan foto selfie — foto dikompres otomatis agar hemat penyimpanan."
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      {loading ? (
        <LoadingBlock label="Memuat absensi…" />
      ) : (
        <>
          {/* ===== Kartu absen hari ini ===== */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-4 w-4 text-primary" />
                  Status Hari Ini
                </CardTitle>
                <CardDescription>
                  {data?.tanggalServer ? formatTanggalIndo(data.tanggalServer) : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hariIni ? (
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setLihatFoto(hariIni.fotoUrl)}
                      className="shrink-0 overflow-hidden rounded-lg border"
                      aria-label="Lihat foto absensi"
                    >
                      { }
                      <img
                        src={hariIni.fotoUrl}
                        alt={`Selfie absensi ${user.name}`}
                        className="h-20 w-20 object-cover"
                      />
                    </button>
                    <div className="min-w-0 space-y-1.5 text-sm">
                      <StatusAbsensiBadge status={hariIni.status} />
                      <p className="text-muted-foreground">
                        Absen pukul <span className="font-medium text-foreground">{hariIni.jam.slice(0, 5)}</span> WIB
                      </p>
                      {hariIni.keterangan ? (
                        <p className="text-muted-foreground">
                          Keterangan: <span className="text-foreground">{hariIni.keterangan}</span>
                        </p>
                      ) : null}
                      {hariIni.catatanAdmin ? (
                        <p className="rounded-md bg-muted px-2 py-1 text-xs">
                          Catatan admin: {hariIni.catatanAdmin}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Belum absen hari ini. Ambil foto selfie untuk absen.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ===== Form ambil selfie ===== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageUp className="h-4 w-4 text-primary" />
                  {hariIni ? 'Absen Ulang' : 'Ambil Selfie'}
                </CardTitle>
                <CardDescription>
                  {hariIni
                    ? 'Absen ulang akan menimpa absen hari ini dan status kembali menunggu ACC.'
                    : 'Foto dikompres otomatis (maks 720px, JPEG) sebelum diunggah.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending ? (
                  <>
                    <div className="flex items-start gap-3">
                      { }
                      <img
                        src={pending.previewUrl}
                        alt="Preview selfie"
                        className="h-24 w-24 rounded-lg border object-cover"
                      />
                      <div className="min-w-0 flex-1 space-y-1 text-sm">
                        <p className="font-medium">Foto siap dikirim</p>
                        <p className="text-muted-foreground">
                          {formatBytes(pending.originalSize)} →{' '}
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {formatBytes(pending.compressedSize)}
                          </span>{' '}
                          {hemat > 0 ? `(hemat ${hemat}%)` : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pending.width}×{pending.height} px • JPEG
                        </p>
                      </div>
                    </div>
                    <Input
                      placeholder="Keterangan (opsional) — mis. mengajar halaqoh A"
                      value={keterangan}
                      maxLength={200}
                      onChange={(e) => setKeterangan(e.target.value)}
                      disabled={submitting}
                    />
                    <div className="flex gap-2">
                      <Button onClick={kirimAbsen} disabled={submitting} className="flex-1">
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Mengirim…
                          </span>
                        ) : (
                          <>
                            <Send className="h-4 w-4" /> Kirim Absen
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={batalPilih} disabled={submitting}>
                        Batal
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={() => kameraRef.current?.click()} disabled={compressing}>
                      <Camera className="h-4 w-4" />
                      {compressing ? 'Mengompres…' : 'Buka Kamera'}
                    </Button>
                    <Button variant="outline" onClick={() => galeriRef.current?.click()} disabled={compressing}>
                      <Images className="h-4 w-4" /> Pilih dari Galeri
                    </Button>
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Gunakan kamera depan untuk selfie. Foto besar otomatis dikecilkan
                      sehingga unggahan ringan dan tidak memberatkan penyimpanan.
                    </p>
                  </div>
                )}
                {/* Input kamera (capture=depan) & galeri — tersembunyi */}
                <input
                  ref={kameraRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    void terapkanFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <input
                  ref={galeriRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void terapkanFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* ===== Riwayat absensi ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" /> Riwayat Absensi
              </CardTitle>
              <CardDescription>30 absensi terakhir beserta status verifikasinya.</CardDescription>
            </CardHeader>
            <CardContent>
              {riwayat.length === 0 ? (
                <EmptyState
                  icon={<Camera />}
                  title="Belum ada riwayat absensi"
                  description="Absensi yang Anda kirim akan tampil di sini beserta statusnya."
                />
              ) : (
                <>
                  {/* Tabel desktop */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Jam</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead>Catatan Admin</TableHead>
                          <TableHead className="text-right">Foto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {riwayat.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="whitespace-nowrap">
                              <span className="font-medium">{hariFromTanggal(item.tanggal)}</span>
                              {', '}
                              {formatTanggalIndo(item.tanggal)}
                            </TableCell>
                            <TableCell className="tabular-nums">{item.jam.slice(0, 5)}</TableCell>
                            <TableCell>
                              <StatusAbsensiBadge status={item.status} />
                            </TableCell>
                            <TableCell className="max-w-40 truncate">
                              {item.keterangan ?? <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="max-w-40 truncate">
                              {item.catatanAdmin ?? <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <button
                                type="button"
                                onClick={() => setLihatFoto(item.fotoUrl)}
                                className={cn(
                                  'inline-block overflow-hidden rounded-md border transition-opacity hover:opacity-80'
                                )}
                                aria-label={`Lihat foto absensi ${item.tanggal}`}
                              >
                                { }
                                <img
                                  src={item.fotoUrl}
                                  alt={`Selfie absensi ${item.tanggal}`}
                                  className="h-10 w-10 object-cover"
                                  loading="lazy"
                                />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Kartu mobile */}
                  <div className="grid gap-3 md:hidden">
                    {riwayat.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <button
                          type="button"
                          onClick={() => setLihatFoto(item.fotoUrl)}
                          className="shrink-0 overflow-hidden rounded-md border"
                          aria-label={`Lihat foto absensi ${item.tanggal}`}
                        >
                          { }
                          <img
                            src={item.fotoUrl}
                            alt={`Selfie absensi ${item.tanggal}`}
                            className="h-14 w-14 object-cover"
                            loading="lazy"
                          />
                        </button>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium">
                            {hariFromTanggal(item.tanggal)}, {formatTanggalIndo(item.tanggal)}{' '}
                            <span className="font-normal text-muted-foreground">
                              • {item.jam.slice(0, 5)} WIB
                            </span>
                          </p>
                          <StatusAbsensiBadge status={item.status} />
                          {item.keterangan ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.keterangan}
                            </p>
                          ) : null}
                          {item.catatanAdmin ? (
                            <p className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              Admin: {item.catatanAdmin}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog lihat foto ukuran penuh */}
      <Dialog open={Boolean(lihatFoto)} onOpenChange={(open) => !open && setLihatFoto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Foto Selfie Absensi</DialogTitle>
            <DialogDescription>Foto sudah dikompres otomatis sebelum diunggah.</DialogDescription>
          </DialogHeader>
          {lihatFoto ? (
             
            <img
              src={lihatFoto}
              alt="Foto selfie absensi ukuran penuh"
              className="max-h-[65vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
