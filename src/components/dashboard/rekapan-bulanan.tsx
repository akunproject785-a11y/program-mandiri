'use client'

/**
 * Tab "Rekapan Bulanan" pada menu Rekap Setoran.
 * Rekap satu bulan per siswa, urut NIS:
 * - Setoran awal bulan  = catatan setoran PERTAMA pada bulan terpilih.
 * - Setoran akhir bulan = catatan setoran TERAKHIR pada bulan terpilih.
 * - Jumlah baris ditotal = penjumlahan field "jumlahBaris" semua setoran bulan itu,
 *   dengan baris Total di bawah tabel.
 * Mendukung Cetak PDF (area #tahfidz-print-area — CSS cetak didefinisikan induk)
 * dan Bagikan WhatsApp (teks rekap siap kirim).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Inbox,
  MessageCircle,
  Printer,
  RotateCcw,
} from 'lucide-react'
import { api } from '@/lib/client'
import {
  describeSetoran,
  formatTanggalIndo,
  formatTanggalPendek,
  todayISO,
} from '@/lib/format'
import type { HalaqohItem, RekapBulananData, UserInfo } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, LoadingBlock } from '@/components/dashboard/ui-helpers'
import WaShareDialog from '@/components/dashboard/wa-share-dialog'

const ALL = 'ALL'

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Format angka gaya Indonesia: 1234 → "1.234". */
function formatAngka(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

/** Dropdown filter kecil dengan label di atasnya. */
function FilterSelect({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={`Filter ${label}`} className="w-full min-h-11">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

/** Isi satu sel "setoran awal/akhir bulan": tanggal + ringkasan isi setoran. */
function isiSel(ringkas: string | null, tanggal: string | null, hari: string | null) {
  if (!ringkas || !tanggal) return '—'
  return (
    <>
      <p className="whitespace-nowrap font-medium">
        {formatTanggalPendek(tanggal)}
        {hari ? <span className="text-xs font-normal text-muted-foreground"> • {hari}</span> : null}
      </p>
      <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">{ringkas}</p>
    </>
  )
}

export default function RekapanBulananView({
  user,
  halaqohList,
}: {
  user: UserInfo
  halaqohList: HalaqohItem[]
}) {
  const [bulan, setBulan] = useState(() => new Date().getMonth() + 1)
  const [tahun, setTahun] = useState(() => new Date().getFullYear())
  const [halaqohId, setHalaqohId] = useState<string>(ALL)
  const [data, setData] = useState<RekapBulananData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [waOpen, setWaOpen] = useState(false)

  /** Opsi tahun: tahun berjalan +1 ke atas, mundur 6 tahun. */
  const tahunOptions = useMemo(() => {
    const y = new Date().getFullYear()
    const list: number[] = []
    for (let t = y + 1; t >= y - 5; t--) list.push(t)
    return list
  }, [])

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ bulan: String(bulan), tahun: String(tahun) })
    if (halaqohId !== ALL) params.set('halaqohId', halaqohId)
    api<RekapBulananData>(`/api/setoran/rekap-bulanan?${params.toString()}`)
      .then((d) => {
        if (!mounted) return
        setData(d)
        setError(null)
      })
      .catch((err: Error) => {
        if (!mounted) return
        setData(null)
        setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [bulan, tahun, halaqohId, refreshKey])

  /** Terapkan perubahan filter + tandai sedang memuat (pola sama dengan RekapanSection). */
  const updateFilter = (patch: { bulan?: number; tahun?: number; halaqohId?: string }) => {
    if (patch.bulan !== undefined) setBulan(patch.bulan)
    if (patch.tahun !== undefined) setTahun(patch.tahun)
    if (patch.halaqohId !== undefined) setHalaqohId(patch.halaqohId)
    setLoading(true)
  }

  const resetFilter = () => {
    const d = new Date()
    setBulan(d.getMonth() + 1)
    setTahun(d.getFullYear())
    setHalaqohId(ALL)
    setLoading(true)
  }

  /** Ringkasan filter untuk header laporan cetak & teks WA. */
  const filterRingkas = useMemo(() => {
    const halaqohLabel =
      halaqohId === ALL
        ? 'Semua Halaqoh'
        : halaqohList.find((h) => h.id === halaqohId)?.nama ?? '-'
    return `Bulan: ${NAMA_BULAN[bulan - 1]} ${tahun} • Halaqoh: ${halaqohLabel}`
  }, [bulan, tahun, halaqohId, halaqohList])

  const canShare = !loading && !error && !!data && data.rekap.length > 0

  /** Teks rekap bulanan siap kirim WhatsApp (dipotong bila sangat panjang). */
  const buildWAText = useCallback((): string => {
    if (!data) return ''
    const lines: string[] = []
    lines.push('*REKAPAN BULANAN SETORAN TAHFIDZ*')
    lines.push("Program Qur'an Mandiri")
    lines.push('')
    lines.push(filterRingkas)
    lines.push('')
    data.rekap.forEach((r, i) => {
      const awalIsi = r.awal ? describeSetoran(r.awal) : ''
      const akhirIsi = r.akhir ? describeSetoran(r.akhir) : ''
      lines.push(
        `${i + 1}. ${r.nama} — NIS ${r.nis}${r.halaqohNama ? ` (${r.halaqohNama})` : ''}`
      )
      lines.push(
        `   Awal bulan: ${r.awal ? `${formatTanggalPendek(r.awal.tanggal)}${awalIsi ? ` — ${awalIsi}` : ''}` : '—'}`
      )
      lines.push(
        `   Akhir bulan: ${r.akhir ? `${formatTanggalPendek(r.akhir.tanggal)}${akhirIsi ? ` — ${akhirIsi}` : ''}` : '—'}`
      )
      lines.push(
        `   Total: ${r.jumlahSetoran} setoran • ${formatAngka(r.totalBaris)} baris`
      )
    })
    lines.push('')
    lines.push(
      `Total keseluruhan: ${data.jumlahSiswa} siswa • ${formatAngka(data.totalSetoran)} setoran • ${formatAngka(data.totalBaris)} baris`
    )
    lines.push('')
    lines.push("_Dikirim dari aplikasi Program Qur'an Mandiri_")
    const text = lines.join('\n')
    // WhatsApp menerima ±65.000 karakter; jaga aman.
    return text.length > 3000
      ? text.slice(0, 3000) + '\n\n…(data dipotong, cetak PDF untuk laporan lengkap)'
      : text
  }, [data, filterRingkas])

  const waText = useMemo(() => buildWAText(), [buildWAText])

  return (
    <>
      {/* Filter bar: bulan, tahun, halaqoh */}
      <Card className="gap-0 p-4 print:hidden">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <FilterSelect
            label="Bulan"
            value={String(bulan)}
            onValueChange={(v) => updateFilter({ bulan: parseInt(v, 10) })}
          >
            {NAMA_BULAN.map((nama, idx) => (
              <SelectItem key={nama} value={String(idx + 1)}>
                {nama}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Tahun"
            value={String(tahun)}
            onValueChange={(v) => updateFilter({ tahun: parseInt(v, 10) })}
          >
            {tahunOptions.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Halaqoh"
            value={halaqohId}
            onValueChange={(v) => updateFilter({ halaqohId: v })}
          >
            <SelectItem value={ALL}>Semua Halaqoh</SelectItem>
            {halaqohList.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.nama}
              </SelectItem>
            ))}
          </FilterSelect>
          <div className="flex items-end justify-start md:justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilter}
              className="min-h-11 text-muted-foreground sm:min-h-9"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Data rekap */}
      {loading ? (
        <Card className="mt-4 gap-0 py-0 print:hidden">
          <LoadingBlock label="Memuat rekap bulanan…" />
        </Card>
      ) : error ? (
        <Card className="mt-4 gap-0 py-0 print:hidden">
          <EmptyState
            icon={<AlertTriangle />}
            title="Gagal memuat rekap bulanan"
            description={error}
          >
            <Button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="min-h-11 sm:min-h-9"
            >
              Coba Lagi
            </Button>
          </EmptyState>
        </Card>
      ) : !data || data.rekap.length === 0 ? (
        <Card className="mt-4 gap-0 py-0 print:hidden">
          <EmptyState
            icon={<Inbox />}
            title={`Belum ada setoran pada ${data?.labelBulan ?? 'bulan ini'}`}
            description="Pilih bulan lain, atau catat setoran melalui menu Input Setoran / tombol Catat Setoran."
          />
        </Card>
      ) : (
        <>
          {/* Ringkasan + tombol bagikan/cetak */}
          <div className="mt-4 flex flex-col gap-2 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">
                {data.jumlahSiswa} siswa
              </span>
              <span className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground">
                Total: {formatAngka(data.totalSetoran)} setoran
              </span>
              <span className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground">
                Total: {formatAngka(data.totalBaris)} baris
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                title="Cetak / simpan rekap bulanan sebagai PDF"
                className="min-h-11 sm:min-h-9"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Cetak PDF
              </Button>
              <Button
                onClick={() => setWaOpen(true)}
                title="Review hasil rekap, salin teks, lalu bagikan ke grup WhatsApp"
                className="min-h-11 bg-[#25D366] text-white hover:bg-[#1eb85a] sm:min-h-9"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Bagikan WhatsApp
              </Button>
            </div>
          </div>

          {/* Tabel desktop */}
          <Card className="mt-2 hidden max-h-[70vh] gap-0 overflow-auto py-0 [scrollbar-width:thin] md:block print:hidden">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-8">No</TableHead>
                  <TableHead className="w-20">NIS</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-28">Halaqoh</TableHead>
                  <TableHead className="min-w-[190px]">Setoran Awal Bulan</TableHead>
                  <TableHead className="min-w-[190px]">Setoran Akhir Bulan</TableHead>
                  <TableHead className="w-16 text-right">Setoran</TableHead>
                  <TableHead className="w-24 text-right">Jumlah Baris</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rekap.map((r, i) => (
                  <TableRow key={r.siswaId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{r.nis}</TableCell>
                    <TableCell>
                      <p className="font-medium">{r.nama}</p>
                      <p className="text-xs text-muted-foreground">{r.kelas}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="max-w-[120px] truncate" title={r.halaqohNama ?? undefined}>
                        {r.halaqohNama ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isiSel(
                        r.awal ? describeSetoran(r.awal) : null,
                        r.awal?.tanggal ?? null,
                        r.awal?.hari ?? null
                      )}
                    </TableCell>
                    <TableCell>
                      {isiSel(
                        r.akhir ? describeSetoran(r.akhir) : null,
                        r.akhir?.tanggal ?? null,
                        r.akhir?.hari ?? null
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.jumlahSetoran}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatAngka(r.totalBaris)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Baris total: jumlah setoran & jumlah baris dijumlahkan */}
                <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                  <TableCell colSpan={6}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAngka(data.totalSetoran)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAngka(data.totalBaris)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>

          {/* Kartu mobile */}
          <div className="mt-2 grid gap-3 md:hidden print:hidden">
            {data.rekap.map((r, i) => (
              <Card key={r.siswaId} className="gap-0 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{r.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      NIS {r.nis} • {r.kelas} • {r.halaqohNama ?? 'Tanpa halaqoh'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">#{i + 1}</span>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Setoran awal bulan
                    </dt>
                    <dd>
                      {r.awal
                        ? `${formatTanggalPendek(r.awal.tanggal)} — ${describeSetoran(r.awal) || '—'}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Setoran akhir bulan
                    </dt>
                    <dd>
                      {r.akhir
                        ? `${formatTanggalPendek(r.akhir.tanggal)} — ${describeSetoran(r.akhir) || '—'}`
                        : '—'}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{r.jumlahSetoran} setoran</Badge>
                  <Badge variant="outline">{formatAngka(r.totalBaris)} baris</Badge>
                </div>
              </Card>
            ))}
            {/* Total keseluruhan (mobile) */}
            <Card className="gap-0 bg-muted/50 p-4">
              <p className="text-sm font-semibold">Total keseluruhan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.jumlahSiswa} siswa • {formatAngka(data.totalSetoran)} setoran •{' '}
                {formatAngka(data.totalBaris)} baris
              </p>
            </Card>
          </div>
        </>
      )}

      {/* Dialog review share WhatsApp */}
      <WaShareDialog open={waOpen} onOpenChange={setWaOpen} text={waText} />

      {/* ====== AREA CETAK PDF BULANAN (hanya tampil saat print) ====== */}
      {canShare && data ? (
        <div id="tahfidz-print-area" className="hidden print:block">
          {/* Kepala laporan */}
          <div className="text-center">
            <p className="text-[13px] font-bold uppercase tracking-widest">
              Rekapan Bulanan Setoran Tahfidz
            </p>
            <p className="mt-0.5 text-[12px] font-semibold">Program Qur&apos;an Mandiri</p>
            <p className="mx-auto mt-1 max-w-full text-[10px] text-gray-600">{filterRingkas}</p>
          </div>

          {/* Ringkasan */}
          <p className="mt-3 text-[11px]">
            <span className="font-semibold">
              Total: {data.jumlahSiswa} siswa • {formatAngka(data.totalSetoran)} setoran •{' '}
              {formatAngka(data.totalBaris)} baris
            </span>
          </p>

          {/* Tabel laporan */}
          <table className="mt-2 text-[10px]">
            <thead>
              <tr>
                <th className="w-8">No</th>
                <th className="w-16">NIS</th>
                <th className="w-32">Nama</th>
                <th className="w-14">Kelas</th>
                <th className="w-24">Halaqoh</th>
                <th>Setoran Awal Bulan</th>
                <th>Setoran Akhir Bulan</th>
                <th className="w-12">Set.</th>
                <th className="w-14">Baris</th>
              </tr>
            </thead>
            <tbody>
              {data.rekap.map((r, i) => (
                <tr key={r.siswaId}>
                  <td>{i + 1}</td>
                  <td>{r.nis}</td>
                  <td>
                    <span className="font-semibold">{r.nama}</span>
                  </td>
                  <td>{r.kelas}</td>
                  <td>{r.halaqohNama ?? '-'}</td>
                  <td>
                    {r.awal ? (
                      <>
                        {formatTanggalPendek(r.awal.tanggal)}
                        <br />
                        <span className="text-gray-500">
                          {describeSetoran(r.awal) || '-'}
                        </span>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    {r.akhir ? (
                      <>
                        {formatTanggalPendek(r.akhir.tanggal)}
                        <br />
                        <span className="text-gray-500">
                          {describeSetoran(r.akhir) || '-'}
                        </span>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{r.jumlahSetoran}</td>
                  <td>{formatAngka(r.totalBaris)}</td>
                </tr>
              ))}
              {/* Baris total */}
              <tr>
                <td colSpan={7} className="text-right font-semibold">
                  Total
                </td>
                <td className="font-semibold">{formatAngka(data.totalSetoran)}</td>
                <td className="font-semibold">{formatAngka(data.totalBaris)}</td>
              </tr>
            </tbody>
          </table>

          {/* Tanda tangan */}
          <div className="mt-8 flex justify-end">
            <div className="text-center text-[11px]">
              <p>{formatTanggalIndo(todayISO())}</p>
              <p>Pembina Halaqoh</p>
              <div className="h-14" aria-hidden />
              <p className="font-semibold underline">( {user.name} )</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
