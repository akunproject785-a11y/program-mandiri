'use client'

/**
 * Section Rekap Absen Musyrif (admin):
 * - Ringkasan absensi per MINGGU (Senin–Minggu) dan per BULAN.
 * - BACKUP per periode ke Excel (.xlsx, 2 sheet: detail + ringkasan) atau PDF
 *   (window.print dengan area laporan A4) — disarankan sebelum menghapus data.
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
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { formatTanggalIndo, hariFromTanggal } from '@/lib/format'
import {
  agregasiPerMusyrif,
  labelStatusAbsensi,
  namaFileAbsensi,
  stempelWaktu,
  unduhExcelAbsensi,
  urutkanAbsensi,
  type RingkasanMusyrif,
} from '@/lib/absensi-export'
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

/** CSS khusus cetak PDF: sembunyikan seluruh halaman, tampilkan hanya area laporan A4. */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  body:has(#absensi-print-area) * { visibility: hidden !important; }
  body:has(#absensi-print-area) #absensi-print-area,
  body:has(#absensi-print-area) #absensi-print-area * { visibility: visible !important; }
  #absensi-print-area {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    color: #000 !important;
    background: #fff !important;
  }
  #absensi-print-area table { border-collapse: collapse; width: 100%; margin-top: 4px; }
  #absensi-print-area th, #absensi-print-area td {
    border: 0.6pt solid #9ca3af;
    padding: 4px 6px;
    text-align: left;
    vertical-align: top;
  }
  #absensi-print-area thead th { background: #f3f4f6; }
}
`

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
  const [detail, setDetail] = useState<RingkasanMusyrif[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const ambilItemsPeriode = async (p: RekapAbsenPeriod) => {
    const { items } = await api<{ items: AbsensiMusyrifItem[] }>(
      `/api/absensi/admin?dari=${p.mulai}&sampai=${p.sampai}`
    )
    return items
  }

  const bukaDetail = async (p: RekapAbsenPeriod) => {
    if (detailKey === p.key) {
      setDetailKey(null)
      return
    }
    setDetailKey(p.key)
    setDetail([])
    setDetailLoading(true)
    try {
      const items = await ambilItemsPeriode(p)
      setDetail(agregasiPerMusyrif(items))
    } catch (err) {
      toast.error((err as Error).message)
      setDetailKey(null)
    } finally {
      setDetailLoading(false)
    }
  }

  // ===== Backup periode ke Excel / PDF =====
  const [ekspor, setEkspor] = useState<{ key: string; fmt: 'xlsx' | 'pdf' } | null>(null)
  const [pdfData, setPdfData] = useState<{
    periode: RekapAbsenPeriod
    items: AbsensiMusyrifItem[]
    ringkasan: RingkasanMusyrif[]
  } | null>(null)

  const eksporExcel = async (p: RekapAbsenPeriod) => {
    setEkspor({ key: p.key, fmt: 'xlsx' })
    try {
      const items = await ambilItemsPeriode(p)
      if (items.length === 0) {
        toast.info('Tidak ada data absensi pada periode ini.')
        return
      }
      await unduhExcelAbsensi(p, items)
      toast.success('Backup Excel terunduh', {
        description: namaFileAbsensi(p, 'xlsx'),
      })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setEkspor(null)
    }
  }

  const eksporPdf = async (p: RekapAbsenPeriod) => {
    setEkspor({ key: p.key, fmt: 'pdf' })
    try {
      const items = await ambilItemsPeriode(p)
      if (items.length === 0) {
        toast.info('Tidak ada data absensi pada periode ini.')
        return
      }
      setPdfData({
        periode: p,
        items: urutkanAbsensi(items),
        ringkasan: agregasiPerMusyrif(items),
      })
      // Beri waktu React merender area cetak sebelum dialog print terbuka.
      setTimeout(() => window.print(), 150)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setEkspor(null)
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
        description="Ringkasan absensi per minggu & per bulan — backup ke Excel/PDF, atau hapus data lama per periode agar penyimpanan tidak penuh."
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Backup dulu periode ke <span className="font-medium text-foreground">Excel</span> atau{' '}
            <span className="font-medium text-foreground">PDF</span> sebelum menghapus. Menghapus satu periode akan menghapus{' '}
            <span className="font-medium text-foreground">semua record absensi</span> pada periode tersebut beserta{' '}
            <span className="font-medium text-foreground">foto selfie-nya dari storage</span>. Total data saat ini:{' '}
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
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                              onClick={() => void eksporExcel(p)}
                              disabled={Boolean(ekspor)}
                              aria-label={`Backup Excel periode ${p.label}`}
                            >
                              {ekspor?.key === p.key && ekspor.fmt === 'xlsx' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="h-4 w-4" />
                              )}{' '}
                              Excel
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void eksporPdf(p)}
                              disabled={Boolean(ekspor)}
                              aria-label={`Backup PDF periode ${p.label}`}
                            >
                              {ekspor?.key === p.key && ekspor.fmt === 'pdf' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}{' '}
                              PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setHapusTarget(p)}
                            >
                              <Trash2 className="h-4 w-4" /> Hapus
                            </Button>
                          </div>
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

      {/* ====== AREA CETAK PDF BACKUP (hanya tampil saat print) ====== */}
      <style>{PRINT_CSS}</style>
      {pdfData ? (
        <div id="absensi-print-area" className="hidden print:block">
          {/* Kepala laporan */}
          <div className="text-center">
            <p className="text-[13px] font-bold uppercase tracking-widest">Rekap Absen Musyrif</p>
            <p className="mt-0.5 text-[12px] font-semibold">Program Qur&apos;an Mandiri</p>
            <p className="mt-1 text-[10px] text-gray-600">
              Periode: {pdfData.periode.label} ({formatTanggalIndo(pdfData.periode.mulai)} s.d.{' '}
              {formatTanggalIndo(pdfData.periode.sampai)})
            </p>
          </div>

          {/* Ringkasan per musyrif */}
          <p className="mt-3 text-[11px] font-semibold">Ringkasan per Musyrif</p>
          <table className="text-[10px]">
            <thead>
              <tr>
                <th>Musyrif</th>
                <th className="w-20 text-center">Hadir (ACC)</th>
                <th className="w-20 text-center">Menunggu</th>
                <th className="w-16 text-center">Ditolak</th>
                <th className="w-14 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {pdfData.ringkasan.map((r) => (
                <tr key={r.musyrifNama}>
                  <td>{r.musyrifNama}</td>
                  <td className="text-center">{r.acc}</td>
                  <td className="text-center">{r.pending}</td>
                  <td className="text-center">{r.tolak}</td>
                  <td className="text-center font-semibold">{r.total}</td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold">TOTAL</td>
                <td className="text-center font-semibold">
                  {pdfData.ringkasan.reduce((s, r) => s + r.acc, 0)}
                </td>
                <td className="text-center font-semibold">
                  {pdfData.ringkasan.reduce((s, r) => s + r.pending, 0)}
                </td>
                <td className="text-center font-semibold">
                  {pdfData.ringkasan.reduce((s, r) => s + r.tolak, 0)}
                </td>
                <td className="text-center font-semibold">{pdfData.items.length}</td>
              </tr>
            </tbody>
          </table>

          {/* Detail absensi */}
          <p className="mt-3 text-[11px] font-semibold">Detail Absensi ({pdfData.items.length})</p>
          <table className="text-[10px]">
            <thead>
              <tr>
                <th className="w-8">No</th>
                <th className="w-24">Tanggal</th>
                <th className="w-14">Hari</th>
                <th className="w-12">Jam</th>
                <th className="w-32">Musyrif</th>
                <th className="w-20">Status</th>
                <th>Keterangan</th>
                <th>Catatan Admin</th>
              </tr>
            </thead>
            <tbody>
              {pdfData.items.map((it, i) => (
                <tr key={it.id}>
                  <td className="text-center">{i + 1}</td>
                  <td>{formatTanggalIndo(it.tanggal)}</td>
                  <td>{hariFromTanggal(it.tanggal)}</td>
                  <td className="text-center">{it.jam.slice(0, 5)}</td>
                  <td>{it.musyrifNama}</td>
                  <td>{labelStatusAbsensi(it.status)}</td>
                  <td>{it.keterangan ?? ''}</td>
                  <td>{it.catatanAdmin ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer + tanda tangan */}
          <div className="mt-6 flex items-start justify-between text-[10px]">
            <p>Dicetak: {stempelWaktu()} WIB</p>
            <div className="text-center">
              <p>Mengetahui,</p>
              <p className="mt-12">Admin Program Qur&apos;an Mandiri</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
