'use client'

/**
 * Section Kelola Absen Musyrif (admin): verifikasi absensi harian musyrif.
 * - Filter status (Semua/Menunggu/ACC/Ditolak) + rentang tanggal.
 * - ACC langsung; Tolak lewat dialog (bisa mencantumkan alasan).
 * - Realtime: section di-remount dashboard saat ada absensi baru (key absensiTick).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Filter,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { formatTanggalIndo, hariFromTanggal } from '@/lib/format'
import type { AbsensiMusyrifItem, StatusAbsensi } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, LoadingBlock, SectionHeader } from '@/components/dashboard/ui-helpers'
import { StatusAbsensiBadge } from '@/components/dashboard/absensi-section'

type FilterStatus = 'SEMUA' | StatusAbsensi

const OPSI_STATUS: { value: FilterStatus; label: string }[] = [
  { value: 'SEMUA', label: 'Semua Status' },
  { value: 'PENDING', label: 'Menunggu ACC' },
  { value: 'ACC', label: 'ACC' },
  { value: 'TOLAK', label: 'Ditolak' },
]

export default function KelolaAbsensiSection() {
  const [items, setItems] = useState<AbsensiMusyrifItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filter (langsung memicu refetch)
  const [status, setStatus] = useState<FilterStatus>('SEMUA')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const muat = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'SEMUA') params.set('status', status)
    if (dari) params.set('dari', dari)
    if (sampai) params.set('sampai', sampai)
    const qs = params.toString()
    api<{ items: AbsensiMusyrifItem[] }>(`/api/absensi/admin${qs ? `?${qs}` : ''}`)
      .then((data) => {
        if (mounted) setItems(data.items)
      })
      .catch((err: Error) => {
        if (mounted) toast.error(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [status, dari, sampai, refreshKey])

  const resetFilter = () => {
    setStatus('SEMUA')
    setDari('')
    setSampai('')
  }

  const adaFilter = status !== 'SEMUA' || dari !== '' || sampai !== ''

  const statistik = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((i) => i.status === 'PENDING').length,
      acc: items.filter((i) => i.status === 'ACC').length,
      tolak: items.filter((i) => i.status === 'TOLAK').length,
    }),
    [items]
  )

  // ===== Aksi ACC / Tolak =====
  const [aksiLoading, setAksiLoading] = useState<string | null>(null)
  const [tolakTarget, setTolakTarget] = useState<AbsensiMusyrifItem | null>(null)
  const [tolakCatatan, setTolakCatatan] = useState('')
  const [tolakLoading, setTolakLoading] = useState(false)

  const patchAksi = async (id: string, aksi: 'ACC' | 'TOLAK', catatan?: string) => {
    setAksiLoading(id + aksi)
    try {
      const { absensi } = await api<{ absensi: AbsensiMusyrifItem }>(
        `/api/absensi/admin/${id}`,
        { method: 'PATCH', body: { aksi, catatan } }
      )
      setItems((prev) => prev.map((it) => (it.id === id ? absensi : it)))
      toast.success(
        aksi === 'ACC'
          ? `Absensi ${absensi.musyrifNama} di-ACC`
          : `Absensi ${absensi.musyrifNama} ditolak`
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAksiLoading(null)
    }
  }

  const submitTolak = async () => {
    if (!tolakTarget) return
    setTolakLoading(true)
    await patchAksi(tolakTarget.id, 'TOLAK', tolakCatatan.trim() || undefined)
    setTolakLoading(false)
    setTolakTarget(null)
    setTolakCatatan('')
  }

  // ===== Dialog foto =====
  const [foto, setFoto] = useState<AbsensiMusyrifItem | null>(null)

  const spinner = (kunci: string) =>
    aksiLoading === kunci ? (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    ) : null

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Kelola Absen Musyrif"
        description="Verifikasi absensi harian musyrif — ACC bila sesuai, tolak bila tidak valid."
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      {/* Chip statistik */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total (filter ini)', value: statistik.total, cls: '' },
          { label: 'Menunggu ACC', value: statistik.pending, cls: 'text-amber-700 dark:text-amber-400' },
          { label: 'ACC', value: statistik.acc, cls: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Ditolak', value: statistik.tolak, cls: 'text-destructive' },
        ].map((s) => (
          <Card key={s.label} className="gap-0 p-4">
            <p className={`text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Bar filter */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:w-48">
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <Select value={status} onValueChange={(v) => setStatus(v as FilterStatus)}>
              <SelectTrigger className="w-full" aria-label="Filter status absensi">
                <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPSI_STATUS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:w-44">
            <p className="text-xs font-medium text-muted-foreground">Dari tanggal</p>
            <Input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
              aria-label="Filter dari tanggal"
            />
          </div>
          <div className="space-y-1.5 sm:w-44">
            <p className="text-xs font-medium text-muted-foreground">Sampai tanggal</p>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
              aria-label="Filter sampai tanggal"
            />
          </div>
          {adaFilter ? (
            <Button variant="ghost" onClick={resetFilter} className="sm:ml-auto">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Daftar absensi */}
      {loading ? (
        <LoadingBlock label="Memuat absensi…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UserCheck />}
          title="Tidak ada absensi"
          description={
            adaFilter
              ? 'Tidak ada data absensi yang cocok dengan filter. Coba ubah filter atau reset.'
              : 'Belum ada musyrif yang melakukan absensi.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Tabel desktop */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jam</TableHead>
                    <TableHead>Musyrif</TableHead>
                    <TableHead>Foto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{hariFromTanggal(item.tanggal)}</span>
                        {', '}
                        {formatTanggalIndo(item.tanggal)}
                      </TableCell>
                      <TableCell className="tabular-nums">{item.jam.slice(0, 5)}</TableCell>
                      <TableCell className="max-w-44 truncate font-medium">
                        {item.musyrifNama}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setFoto(item)}
                          className="overflow-hidden rounded-md border transition-opacity hover:opacity-80"
                          aria-label={`Lihat foto selfie ${item.musyrifNama}`}
                        >
                          { }
                          <img
                            src={item.fotoUrl}
                            alt={`Selfie absensi ${item.musyrifNama} ${item.tanggal}`}
                            className="h-10 w-10 object-cover"
                            loading="lazy"
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <StatusAbsensiBadge status={item.status} />
                        {item.catatanAdmin ? (
                          <p className="mt-1 max-w-40 truncate text-xs text-muted-foreground">
                            {item.catatanAdmin}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-36 truncate">
                        {item.keterangan ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.status === 'PENDING' ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => patchAksi(item.id, 'ACC')}
                              disabled={aksiLoading !== null}
                              aria-label={`ACC absensi ${item.musyrifNama}`}
                            >
                              {spinner(item.id + 'ACC')}
                              <BadgeCheck className="h-4 w-4" /> ACC
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setTolakTarget(item)
                                setTolakCatatan('')
                              }}
                              disabled={aksiLoading !== null}
                              aria-label={`Tolak absensi ${item.musyrifNama}`}
                            >
                              <X className="h-4 w-4" /> Tolak
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Selesai</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Kartu mobile */}
            <div className="grid gap-3 p-4 md:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setFoto(item)}
                      className="shrink-0 overflow-hidden rounded-md border"
                      aria-label={`Lihat foto selfie ${item.musyrifNama}`}
                    >
                      { }
                      <img
                        src={item.fotoUrl}
                        alt={`Selfie absensi ${item.musyrifNama} ${item.tanggal}`}
                        className="h-14 w-14 object-cover"
                        loading="lazy"
                      />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium">{item.musyrifNama}</p>
                      <p className="text-xs text-muted-foreground">
                        {hariFromTanggal(item.tanggal)}, {formatTanggalIndo(item.tanggal)} •{' '}
                        {item.jam.slice(0, 5)} WIB
                      </p>
                      <StatusAbsensiBadge status={item.status} />
                      {item.keterangan ? (
                        <p className="truncate text-xs text-muted-foreground">{item.keterangan}</p>
                      ) : null}
                      {item.catatanAdmin ? (
                        <p className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          Admin: {item.catatanAdmin}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {item.status === 'PENDING' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => patchAksi(item.id, 'ACC')}
                        disabled={aksiLoading !== null}
                      >
                        {spinner(item.id + 'ACC')}
                        <BadgeCheck className="h-4 w-4" /> ACC
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setTolakTarget(item)
                          setTolakCatatan('')
                        }}
                        disabled={aksiLoading !== null}
                      >
                        <X className="h-4 w-4" /> Tolak
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog tolak dengan catatan */}
      <Dialog
        open={Boolean(tolakTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setTolakTarget(null)
            setTolakCatatan('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Absensi</DialogTitle>
            <DialogDescription>
              {tolakTarget
                ? `Tolak absensi ${tolakTarget.musyrifNama} tanggal ${formatTanggalIndo(tolakTarget.tanggal)}? Berikan alasan agar musyrif mengetahui.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Alasan penolakan (opsional) — mis. foto tidak terlihat jelas"
            value={tolakCatatan}
            maxLength={300}
            onChange={(e) => setTolakCatatan(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTolakTarget(null)
                setTolakCatatan('')
              }}
              disabled={tolakLoading}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={submitTolak} disabled={tolakLoading}>
              {tolakLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Tolak Absensi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog foto ukuran penuh */}
      <Dialog open={Boolean(foto)} onOpenChange={(open) => !open && setFoto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selfie {foto?.musyrifNama}</DialogTitle>
            <DialogDescription>
              {foto ? `${hariFromTanggal(foto.tanggal)}, ${formatTanggalIndo(foto.tanggal)} • ${foto.jam.slice(0, 5)} WIB` : ''}
            </DialogDescription>
          </DialogHeader>
          {foto ? (
             
            <img
              src={foto.fotoUrl}
              alt={`Selfie absensi ${foto.musyrifNama}`}
              className="max-h-[65vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
