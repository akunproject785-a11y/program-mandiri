'use client'

/**
 * Section Hasil Ujian (musyrif) — tampil sebagai menu dashboard bila admin
 * mengaktifkan menu Ujian. Isinya rekap nilai seluruh siswa binaan pada tahun
 * ajaran aktif, DIURUT dari nilai tertinggi:
 *  - 3 teratas → tombol "Cetak Sertifikat" (A4 landscape, peringkat & nilai);
 *  - semua baris → tombol "Cetak Raport" (A4 portrait, rincian per ujian & TP).
 * Cetak memakai Dialog preview (iframe) lalu window.print() — tanpa file server.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Award, Printer, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { formatTanggalIndo } from '@/lib/format'
import type { HasilUjianData, HasilUjianItem, UjianItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

/** Jumlah peringkat teratas yang dapat mencetak sertifikat. */
const JUMLAH_SERTIFIKAT = 3

/** Warna badge peringkat: 1 emas, 2 perak, 3 perunggu. */
function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
      : rank === 2
        ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        : 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums ${cls}`}
      aria-label={`Peringkat ${rank}`}
    >
      {rank}
    </span>
  )
}

/** Warna nilai: < 60 merah, 60–79 amber, >= 80 hijau. */
function NilaiBadge({ nilai }: { nilai: number }) {
  const cls =
    nilai >= 80
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : nilai >= 60
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {nilai}
    </span>
  )
}

/** Escape teks untuk disisipkan ke HTML cetak. */
function esc(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Gaya dasar dokumen cetak (dua varian orientasi). */
const GAYA = (extra: string) => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #444; padding: 6px 8px; font-size: 12px; vertical-align: top; }
  th { background: #f0f0f0; text-align: left; }
  ${extra}
`

/** HTML sertifikat penghargaan (A4 landscape). */
function htmlSertifikat(o: {
  nama: string
  halaqoh: string
  rank: number
  rata: number
  jumlah: number
  ta: string
  musyrif: string
}): string {
  const tanggal = formatTanggalIndo(new Date().toISOString().slice(0, 10))
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Sertifikat ${esc(o.nama)}</title>
<style>${GAYA(`
  @page { size: A4 landscape; margin: 10mm; }
  .bingkai { border: 4px double #8a6d1d; border-radius: 8px; padding: 6px; height: 100%; }
  .dalam { border: 1px dashed #b5942e; border-radius: 6px; padding: 24px 36px; text-align: center; height: 100%; }
  .kop { letter-spacing: 4px; font-size: 13px; color: #8a6d1d; }
  h1 { font-size: 40px; letter-spacing: 6px; margin: 10px 0 2px; color: #6b5416; }
  h2 { font-size: 18px; font-weight: normal; color: #555; margin-bottom: 26px; }
  .diberikan { font-size: 15px; color: #555; }
  .nama { font-size: 34px; font-weight: bold; margin: 10px 0 4px; border-bottom: 2px solid #b5942e; display: inline-block; padding: 0 24px 6px; }
  .halaqoh { font-size: 14px; color: #555; margin-bottom: 24px; }
  .isi { font-size: 15px; line-height: 1.8; }
  .nilai { font-size: 22px; font-weight: bold; color: #6b5416; }
  .ttd { display: flex; justify-content: space-between; margin-top: 34px; font-size: 14px; }
  .ttd div { width: 40%; }
  .garis { margin-top: 46px; border-top: 1px solid #333; padding-top: 4px; font-weight: bold; }
`)}
</head><body><div class="bingkai"><div class="dalam">
  <p class="kop">PROGRAM QUR'AN MANDIRI</p>
  <h1>SERTIFIKAT</h1>
  <h2>Penghargaan Hafalan Al-Qur'an</h2>
  <p class="diberikan">Diberikan kepada</p>
  <p class="nama">${esc(o.nama)}</p>
  <p class="halaqoh">Halaqoh ${esc(o.halaqoh)}</p>
  <p class="isi">
    atas prestasi hafalan Al-Qur'an dengan <span class="nilai">Peringkat ${o.rank}</span><br/>
    dan rata-rata nilai ujian <span class="nilai">${o.rata}</span>
    dari ${o.jumlah} ujian<br/>
    pada Tahun Ajaran ${esc(o.ta)} — Masya Allah, pertahankan dan tingkatkan.
  </p>
  <div class="ttd">
    <div>${tanggal}</div>
    <div>Musyrif / Musyrifah<br/><span class="garis" style="display:block">${esc(o.musyrif)}</span></div>
  </div>
</div></div></body></html>`
}

/** HTML raport ujian per siswa (A4 portrait) — rincian seluruh ujian & nilai per TP. */
function htmlRaport(o: {
  item: HasilUjianItem
  ta: string
  musyrif: string
}): string {
  const tanggalCetak = formatTanggalIndo(new Date().toISOString().slice(0, 10))
  const terbaik = Math.max(...o.item.detail.map((d) => d.nilai))
  const baris = o.item.detail
    .map((d, i) => {
      const rincian = (d.nilaiTp ?? [])
        .map((n, j) => `<div>TP${j + 1}. ${esc(n.teks)}: <b>${n.nilai}</b></div>`)
        .join('')
      const catatan = d.catatan ? `<div style="margin-top:3px;color:#555">Catatan: ${esc(d.catatan)}</div>` : ''
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="white-space:nowrap">${formatTanggalIndo(d.tanggal)}</td>
        <td>${esc(d.jenis)}</td>
        <td>${d.bab ? esc(d.bab) : '—'}</td>
        <td>${rincian}${catatan}</td>
        <td style="text-align:center;font-weight:bold">${d.nilai}</td>
      </tr>`
    })
    .join('')
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Raport ${esc(o.item.siswaNama)}</title>
<style>${GAYA(`
  @page { size: A4 portrait; margin: 12mm; }
  .kop { text-align: center; border-bottom: 3px double #333; padding-bottom: 8px; margin-bottom: 16px; }
  .kop h1 { font-size: 20px; }
  .kop p { font-size: 13px; color: #444; }
  .identitas { width: 60%; margin: 0 auto 14px; font-size: 13px; }
  .identitas td { border: none; padding: 2px 4px; }
  .judul { font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 10px; }
  .rekap { margin-top: 12px; font-size: 13px; }
  .rekap td { border: 1px solid #444; padding: 6px 10px; }
  .ttd { display: flex; justify-content: flex-end; margin-top: 26px; font-size: 13px; }
  .garis { margin-top: 40px; border-top: 1px solid #333; padding-top: 3px; font-weight: bold; }
`)}
</head><body>
  <div class="kop">
    <h1>RAPORT UJIAN HAFALAN AL-QUR'AN</h1>
    <p>Program Qur'an Mandiri — Tahun Ajaran ${esc(o.ta)}</p>
  </div>
  <table class="identitas">
    <tr><td style="width:140px">Nama Siswa</td><td>: <b>${esc(o.item.siswaNama)}</b></td></tr>
    <tr><td>Halaqoh</td><td>: ${esc(o.item.halaqohNama)}</td></tr>
    <tr><td>Musyrif / Musyrifah</td><td>: ${esc(o.musyrif)}</td></tr>
  </table>
  <p class="judul">Daftar Hasil Ujian</p>
  <table>
    <thead><tr><th style="width:26px">No</th><th style="width:88px">Tanggal</th><th style="width:90px">Jenis</th><th style="width:120px">Bab / Hafalan</th><th>Rincian Nilai per TP</th><th style="width:44px;text-align:center">Rata</th></tr></thead>
    <tbody>${baris}</tbody>
  </table>
  <table class="rekap">
    <tr>
      <td>Jumlah ujian: <b>${o.item.jumlahUjian}</b></td>
      <td>Rata-rata keseluruhan: <b>${o.item.rataNilai}</b></td>
      <td>Nilai terbaik: <b>${terbaik}</b></td>
    </tr>
  </table>
  <div class="ttd">
    <div style="text-align:center">${tanggalCetak}<br/>Musyrif / Musyrifah<br/><span class="garis" style="display:block">${esc(o.musyrif)}</span></div>
  </div>
</body></html>`
}

type CetakState = { judul: string; html: string } | null

export default function HasilUjianSection() {
  const [data, setData] = useState<HasilUjianData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cetak, setCetak] = useState<CetakState>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const muat = useCallback(() => {
    setLoading(true)
    api<HasilUjianData>('/api/ujian/hasil')
      .then(setData)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(muat, [muat])

  const bukaSertifikat = (item: HasilUjianItem, rank: number) => {
    setCetak({
      judul: `Sertifikat — ${item.siswaNama} (Peringkat ${rank})`,
      html: htmlSertifikat({
        nama: item.siswaNama,
        halaqoh: item.halaqohNama,
        rank,
        rata: item.rataNilai,
        jumlah: item.jumlahUjian,
        ta: data?.tahunAjaran ?? '',
        musyrif: data?.musyrifNama ?? '',
      }),
    })
  }

  const bukaRaport = (item: HasilUjianItem) => {
    setCetak({
      judul: `Raport — ${item.siswaNama}`,
      html: htmlRaport({ item, ta: data?.tahunAjaran ?? '', musyrif: data?.musyrifNama ?? '' }),
    })
  }

  const cetakSekarang = () => {
    iframeRef.current?.contentWindow?.print()
  }

  if (loading && !data) return <LoadingBlock label="Memuat hasil ujian…" />
  if (!data) return null

  const detailTerakhir = (d: UjianItem[]) => d[0]?.tanggal ?? null

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Hasil Ujian"
        description={
          data.tahunAjaran
            ? `Rekap nilai ujian hafalan binaan Anda pada tahun ajaran ${data.tahunAjaran}, terurut dari nilai tertinggi. ${JUMLAH_SERTIFIKAT} teratas dapat mencetak sertifikat, dan setiap siswa dapat mencetak raport.`
            : 'Rekap nilai ujian hafalan binaan Anda.'
        }
      >
        <Button variant="outline" size="sm" onClick={muat} disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Muat ulang
        </Button>
      </SectionHeader>

      {!data.aktif ? (
        <Card className="gap-0 p-4">
          <p className="text-sm text-muted-foreground">
            Menu Ujian sedang dinonaktifkan admin — hasil tidak diperbarui.
          </p>
        </Card>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Award className="h-10 w-10 text-muted-foreground" />}
          title="Belum ada hasil ujian"
          description="Belum ada ujian yang tercatat pada tahun ajaran ini. Catat ujian siswa lewat menu Ujian, hasilnya akan muncul di sini."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="gap-0 p-4">
              <p className="text-2xl font-bold tabular-nums">{data.items.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Siswa Diujikan</p>
            </Card>
            <Card className="gap-0 p-4">
              <p className="text-2xl font-bold tabular-nums">
                {data.items.reduce((s, i) => s + i.jumlahUjian, 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Total Ujian</p>
            </Card>
            <Card className="gap-0 p-4">
              <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {data.items[0]?.rataNilai ?? '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nilai Tertinggi ({data.items[0]?.siswaNama ?? '—'})
              </p>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Peringkat</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead className="text-center">Ujian</TableHead>
                    <TableHead className="text-center">Ujian Terakhir</TableHead>
                    <TableHead className="text-center">Rata-rata</TableHead>
                    <TableHead className="text-right">Cetak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item, idx) => {
                    const rank = idx + 1
                    const layakSertifikat = rank <= JUMLAH_SERTIFIKAT
                    return (
                      <TableRow key={item.siswaId}>
                        <TableCell className="text-center">
                          <RankBadge rank={rank} />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{item.siswaNama}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.halaqohNama || '—'}
                          </p>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{item.jumlahUjian}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {detailTerakhir(item.detail)
                            ? formatTanggalIndo(detailTerakhir(item.detail) as string)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <NilaiBadge nilai={item.rataNilai} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            {layakSertifikat ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => bukaSertifikat(item, rank)}
                              >
                                <Award className="h-3.5 w-3.5" /> Sertifikat
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => bukaRaport(item)}
                            >
                              <Printer className="h-3.5 w-3.5" /> Raport
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Preview cetak (sertifikat / raport) */}
      <Dialog open={cetak !== null} onOpenChange={(v) => !v && setCetak(null)}>
        <DialogContent className="flex h-[85vh] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle>{cetak?.judul}</DialogTitle>
            <DialogDescription>
              Periksa tampilan dokumen, lalu tekan Cetak untuk mencetak atau menyimpan sebagai PDF.
            </DialogDescription>
          </DialogHeader>
          <iframe
            ref={iframeRef}
            title="Pratinjau cetak"
            srcDoc={cetak?.html ?? ''}
            className="min-h-0 w-full flex-1 rounded-md border bg-white"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCetak(null)}>
              Tutup
            </Button>
            <Button onClick={cetakSekarang}>
              <Printer className="h-4 w-4" /> Cetak
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
