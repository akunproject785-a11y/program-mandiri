'use client'

/**
 * Section Rekap Absen Musyrif (admin):
 * - Ringkasan absensi per MINGGU (Senin–Minggu) dan per BULAN.
 * - Admin dapat MENGHAPUS data satu periode (minggu/bulan) — record database
 *   DAN foto selfie di Supabase Storage ikut terhapus agar penyimpanan tidak penuh.
 * - Detail per musyrif dapat dibuka (jumlah hadir/menunggu/ditolak).
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CalendarRange,
  ChevronDown,
  Database,
  Loader2,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { formatTanggalIndo } from '@/lib/format'
import type { AbsensiMusyrifItem, RekapAbsenPeriod } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog, EmptyState, LoadingBlock, SectionHeader } from '@/components/dashboard/ui-helpers'
import { cn } from '@/lib/utils'

type TipePeriode = 'minggu' | 'bulan'

interface PerMusyrif {
  musyrifNama: string
  acc: number
  pending: number
  tolak: number
  total: number
}

export default function RekapAbsensiSection() {
  const [tipe, setTipe] = useState<TipePeriode>('minggu')
  const [data, setData] = useState<{ minggu: RekapAbsenPeriod[]; bulan: RekapAbsenPeriod[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const muat = useCallback(() => {
    setLoading(true)
    api<{ minggu: RekapAbsenPeriod[]; bulan: RekapAbsenPeriod[]; total: number }>(
      '/api/absensi/admin/rekap'
    )
      .then(setData)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    muat()
  }, [muat])

  const periode = useMemo(() => {
    if (!data) return []
    return tipe === 'minggu' ? data.minggu : data.bulan
  }, [data, tipe])

  // ===== Detail per musyrif untuk satu periode terbuka =====
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<PerMusyrif[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const bukaDetail = async (p: RekapAbsenPeriod) => {
    if (detailKey === p.key) {
      setDetailKey(null)
      return
    }
    setDetailKey(p.key)
    setDetail([])
    setDetailLoading(true)
    try {
      const { items } = await api<{ items: AbsensiMusyrifItem[] }>(
        `/api/absensi/admin?dari=${p.mulai}&sampai=${p.sampai}`
      )
      const map = new Map<string, PerMusyrif>()
      for (const it of items) {
        const cur =
          map.get(it.musyrifNama) ??
          { musyrifNama: it.musyrifNama, acc: 0, pending: 0, tolak: 0, total: 0 }
        if (it.status === 'ACC') cur.acc += 1
        else if (it.status === 'TOLAK') cur.tolak += 1
        else cur.pending += 1
        cur.total += 1
        map.set(it.musyrifNama, cur)
      }
      setDetail([...map.values()].sort((a, b) => b.total - a.total))
    } catch (err) {
      toast.error((err as Error).message)
      setDetailKey(null)
    } finally {
      setDetailLoading(false)
    }
  }

  // ===== Hapus satu periode =====
  const [hapusTarget, setHapusTarget] = useState<RekapAbsenPeriod | null>(null)
  const [hapusLoading, setHapusLoading] = useState(false)

  const konfirmasiHapus = async () => {
    if (!hapusTarget) return
    setHapusLoading(true)
    try {
      const res = await api<{ deleted: number; fotoDihapus: number }>(
        '/api/absensi/admin/rekap',
        { method: 'DELETE', body: { tipe, nilai: hapusTarget.key } }
      )
      toast.success(
        `Data periode terhapus: ${res.deleted} absensi${res.fotoDihapus > 0 ? ` + ${res.fotoDihapus} foto dari storage` : ''}`
      )
      if (detailKey === hapusTarget.key) setDetailKey(null)
      setHapusTarget(null)
      muat()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setHapusLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Rekap Absen Musyrif"
        description="Ringkasan absensi per minggu & per bulan. Hapus data lama per periode agar penyimpanan tidak penuh."
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Menghapus satu periode akan menghapus <span className="font-medium text-foreground">semua record absensi</span> pada
            periode tersebut beserta <span className="font-medium text-foreground">foto selfie-nya dari storage</span>. Total data saat ini:{' '}
            <span className="font-medium text-foreground tabular-nums">{data?.total ?? 0}</span> absensi.
          </p>
        </CardContent>
      </Card>

      <Tabs value={tipe} onValueChange={(v) => setTipe(v as TipePeriode)}>
        <TabsList>
          <TabsTrigger value="minggu" className="gap-1.5">
            <CalendarRange className="h-4 w-4" /> Per Minggu
          </TabsTrigger>
          <TabsTrigger value="bulan" className="gap-1.5">
            <CalendarClock className="h-4 w-4" /> Per Bulan
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <LoadingBlock label="Memuat rekap…" />
      ) : periode.length === 0 ? (
        <EmptyState
          icon={<CalendarRange />}
          title="Belum ada data absensi"
          description="Rekap per minggu dan per bulan akan muncul setelah musyrif mulai absen."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>{tipe === 'minggu' ? 'Minggu (Senin–Minggu)' : 'Bulan'}</TableHead>
                    <TableHead className="text-center">Jumlah Absen</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periode.map((p) => (
                    <Fragment key={p.key}>
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => bukaDetail(p)}
                            aria-label={detailKey === p.key ? 'Tutup detail' : 'Buka detail per musyrif'}
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                detailKey === p.key && 'rotate-180'
                              )}
                            />
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{p.label}</TableCell>
                        <TableCell className="text-center tabular-nums">{p.jumlah}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setHapusTarget(p)}
                          >
                            <Trash2 className="h-4 w-4" /> Hapus
                          </Button>
                        </TableCell>
                      </TableRow>
                      {detailKey === p.key ? (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/40 p-4">
                            {detailLoading ? (
                              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memuat detail…
                              </p>
                            ) : detail.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Tidak ada data.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border bg-background">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Musyrif</TableHead>
                                      <TableHead className="text-center">Hadir (ACC)</TableHead>
                                      <TableHead className="text-center">Menunggu</TableHead>
                                      <TableHead className="text-center">Ditolak</TableHead>
                                      <TableHead className="text-center">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {detail.map((d) => (
                                      <TableRow key={d.musyrifNama}>
                                        <TableCell className="font-medium">{d.musyrifNama}</TableCell>
                                        <TableCell className="text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                                          {d.acc}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums text-amber-700 dark:text-amber-400">
                                          {d.pending}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums text-destructive">
                                          {d.tolak}
                                        </TableCell>
                                        <TableCell className="text-center font-semibold tabular-nums">
                                          {d.total}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(hapusTarget)}
        onOpenChange={(open) => !open && setHapusTarget(null)}
        title="Hapus data absensi periode ini?"
        description={
          hapusTarget
            ? `${hapusTarget.jumlah} absensi pada periode ${hapusTarget.label} akan dihapus permanen, termasuk foto selfie-nya dari storage. Tindakan ini tidak dapat dibatalkan.`
            : ''
        }
        confirmText="Hapus Periode"
        loading={hapusLoading}
        onConfirm={konfirmasiHapus}
      />
    </div>
  )
}
