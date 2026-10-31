'use client'

/**
 * Dialog Import Massal Data Siswa.
 * Sumber data: (1) upload file .xlsx/.xls/.csv — sheet pertama, (2) copy-paste TSV dari Excel.
 * Parse file memakai SheetJS (lazy import agar tidak membebani bundle awal).
 * Preview tervalidasi di client (program/halaqoh/NIS duplikat); validasi final di server.
 */
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type { HalaqohItem, Program } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingBlock } from '@/components/dashboard/ui-helpers'

interface SiswaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programs: Program[]
  halaqohList: HalaqohItem[]
  existingNis: string[]
  onSuccess: () => void
}

interface RawRow {
  nis: string
  nama: string
  kelas: string
  program: string
  halaqoh: string
}

interface ParsedRow extends RawRow {
  row: number
  status: 'ok' | 'error'
  reason?: string
}

interface ImportResult {
  imported: number
  failed: number
  errors: { row: number; nis: string; nama: string; reason?: string }[]
}

const ACCEPT = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

/** Urutan penting: pola spesifik dicek lebih dulu (mis. "Nama Halaqoh" → halaqoh). */
const FIELD_PATTERNS: [keyof RawRow, RegExp][] = [
  ['halaqoh', /halaqoh/i],
  ['nis', /^nis\b/i],
  ['program', /program/i],
  ['kelas', /kelas/i],
  ['nama', /nama/i],
]

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  return String(cell)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
}

function normalizeNis(v: string): string {
  return v.replace(/\.0$/, '').trim()
}

function isEmptyRow(r: RawRow): boolean {
  return !r.nis && !r.nama && !r.kelas && !r.program && !r.halaqoh
}

/** Deteksi baris header: minimal 2 kolom cocok pola. Return peta kolom → field. */
function detectHeader(cells: string[]): Record<number, keyof RawRow> | null {
  const map: Record<number, keyof RawRow> = {}
  let hits = 0
  cells.forEach((c, i) => {
    const t = c.trim()
    if (!t) return
    for (const [field, re] of FIELD_PATTERNS) {
      if (re.test(t)) {
        map[i] = field
        hits += 1
        break
      }
    }
  })
  return hits >= 2 ? map : null
}

/** AoA mentah (dari SheetJS / TSV paste) → baris ternormalisasi.
 *  Header opsional: bila baris pertama terdeteksi sebagai header, gunakan peta kolomnya;
 *  jika tidak, gunakan urutan posisi: NIS, Nama, Kelas, Program, Halaqoh. */
function aoaToRawRows(aoa: unknown[][]): RawRow[] {
  const nonEmpty = aoa.filter((r) => r.some((c) => cellToString(c) !== ''))
  if (nonEmpty.length === 0) return []

  const first = nonEmpty[0].map(cellToString)
  const headerMap = detectHeader(first)
  const dataRows = headerMap ? nonEmpty.slice(1) : nonEmpty

  return dataRows.map((r) => {
    const cells = r.map(cellToString)
    const get = (field: keyof RawRow): string => {
      if (headerMap) {
        const idx = Object.entries(headerMap).find(([, f]) => f === field)?.[0]
        return idx !== undefined ? (cells[Number(idx)] ?? '') : ''
      }
      const pos: Record<keyof RawRow, number> = { nis: 0, nama: 1, kelas: 2, program: 3, halaqoh: 4 }
      return cells[pos[field]] ?? ''
    }
    return {
      nis: normalizeNis(get('nis')),
      nama: get('nama'),
      kelas: get('kelas'),
      program: get('program'),
      halaqoh: get('halaqoh'),
    }
  })
}

export default function SiswaImportDialog({
  open,
  onOpenChange,
  programs,
  halaqohList,
  existingNis,
  onSuccess,
}: SiswaImportDialogProps) {
  const [tab, setTab] = useState<'upload' | 'paste'>('upload')
  const [pasteText, setPasteText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setTab('upload')
    setPasteText('')
    setFileName(null)
    setParsedRows([])
    setParsing(false)
    setImporting(false)
    setResult(null)
  }

  // Reset seluruh state setelah dialog tertutup (delay agar animasi tutup mulus).
  useEffect(() => {
    if (!open) {
      const t = setTimeout(reset, 300)
      return () => clearTimeout(t)
    }
  }, [open])

  const validCount = parsedRows.filter((r) => r.status === 'ok').length

  /** Validasi preview — cermin dari validasi server. */
  const validate = (raw: RawRow[]): ParsedRow[] => {
    const existing = new Set(existingNis)
    const batchNis = new Set<string>()
    const findProgram = (name: string) => {
      const p = programs.find((x) => x.nama === name)
      return p ?? programs.find((x) => x.nama.toLowerCase() === name.toLowerCase())
    }
    const findHalaqoh = (name: string) => {
      const h = halaqohList.find((x) => x.nama === name)
      return h ?? halaqohList.find((x) => x.nama.toLowerCase() === name.toLowerCase())
    }

    return raw.map((r, idx) => {
      const rowNo = idx + 1
      const fail = (reason: string): ParsedRow => ({ ...r, row: rowNo, status: 'error', reason })

      if (!r.nis) return fail('NIS kosong')
      if (!r.nama) return fail('Nama kosong')
      if (!r.kelas) return fail('Kelas kosong')
      if (!r.program) return fail('Program kosong')
      if (existing.has(r.nis)) return fail(`NIS ${r.nis} sudah terdaftar`)
      if (batchNis.has(r.nis)) return fail(`NIS ${r.nis} duplikat dalam data`)
      const program = findProgram(r.program)
      if (!program) return fail(`Program "${r.program}" tidak ditemukan`)
      if (r.halaqoh) {
        const halaqoh = findHalaqoh(r.halaqoh)
        if (!halaqoh) return fail(`Halaqoh "${r.halaqoh}" tidak ditemukan`)
        if (halaqoh.programId !== program.id) {
          return fail(`Halaqoh "${r.halaqoh}" bukan milik program "${program.nama}"`)
        }
      }
      batchNis.add(r.nis)
      return { ...r, row: rowNo, status: 'ok' }
    })
  }

  const applyAoA = (aoa: unknown[][]) => {
    const raw = aoaToRawRows(aoa).filter((r) => !isEmptyRow(r))
    setParsedRows(validate(raw))
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    setFileName(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) throw new Error('sheet kosong')
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: false,
        defval: '',
      })
      setFileName(file.name)
      applyAoA(aoa)
      toast.success(`File "${file.name}" terbaca`)
    } catch {
      toast.error('Gagal membaca file. Pastikan format .xlsx, .xls, atau .csv.')
    } finally {
      setParsing(false)
    }
  }

  const handlePasteParse = () => {
    const text = pasteText.trim()
    if (!text) {
      toast.error('Tempel data terlebih dahulu (Ctrl+V).')
      return
    }
    setParsing(true)
    try {
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
      const aoa = lines.map((l) =>
        l.includes('\t') ? l.split('\t') : l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      )
      applyAoA(aoa)
      setFileName(null)
    } finally {
      setParsing(false)
    }
  }

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/siswa/template', { cache: 'no-store' })
      if (!res.ok) {
        let msg = 'Gagal mengunduh template'
        try {
          msg = ((await res.json()) as { error?: string }).error ?? msg
        } catch {
          /* abaikan */
        }
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template-import-siswa.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Template berhasil diunduh')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunduh template')
    } finally {
      setDownloading(false)
    }
  }

  const doImport = async () => {
    const rows = parsedRows.filter((r) => !isEmptyRow(r))
    if (rows.length === 0) {
      toast.error('Tidak ada data untuk diimpor.')
      return
    }
    setImporting(true)
    try {
      const res = await api<{ imported: number; failed: number; results: ParsedRow[] }>(
        '/api/siswa/import',
        {
          method: 'POST',
          body: {
            rows: rows.map(({ nis, nama, kelas, program, halaqoh }) => ({
              nis,
              nama,
              kelas,
              program,
              halaqoh,
            })),
          },
        }
      )
      const errors = res.results
        .filter((r) => r.status === 'error')
        .map(({ row, nis, nama, reason }) => ({ row, nis, nama, reason }))
      setResult({ imported: res.imported, failed: res.failed, errors })
      if (res.imported > 0) {
        toast.success(`${res.imported} siswa berhasil diimpor`)
        onSuccess()
      } else {
        toast.error('Tidak ada baris yang berhasil diimpor. Periksa alasan pada tabel.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengimpor data')
    } finally {
      setImporting(false)
    }
  }

  const errorCount = parsedRows.length - validCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Massal Siswa</DialogTitle>
          <DialogDescription>
            Tambah banyak siswa sekaligus dari file Excel/CSV atau tempel data langsung dari
            Excel.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          // ===== Tampilan hasil import =====
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium">{result.imported} siswa berhasil diimpor</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {result.failed > 0
                    ? `${result.failed} baris ditolak — lihat alasan di bawah.`
                    : 'Semua baris berhasil diproses tanpa galat.'}
                </p>
              </div>
            </div>
            {result.errors.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-lg border [scrollbar-width:thin]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="pl-4">No</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead className="pr-4">Alasan Ditolak</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((e) => (
                      <TableRow key={e.row}>
                        <TableCell className="pl-4 text-sm text-muted-foreground">{e.row}</TableCell>
                        <TableCell className="font-mono text-sm">{e.nis || '—'}</TableCell>
                        <TableCell className="text-sm">{e.nama || '—'}</TableCell>
                        <TableCell className="pr-4 text-sm text-destructive">{e.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {/* ===== Unduh template ===== */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                Gunakan template resmi — berisi contoh, referensi program/halaqoh, dan petunjuk.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                disabled={downloading}
                className="min-h-11 sm:min-h-9"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Unduh Template
              </Button>
            </div>

            {/* ===== Sumber data: upload / paste ===== */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'paste')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="paste">
                  <ClipboardPaste className="h-4 w-4" />
                  Copy-Paste
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="pt-3">
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/50"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) void handleFile(f)
                  }}
                >
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Klik untuk pilih file, atau tarik file ke sini
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Format .xlsx / .xls / .csv — sheet pertama yang akan dibaca
                  </p>
                  <input
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleFile(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                {fileName ? (
                  <p className="mt-2 text-xs text-muted-foreground">File: {fileName}</p>
                ) : null}
              </TabsContent>

              <TabsContent value="paste" className="space-y-2 pt-3">
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handlePasteParse()
                  }}
                  rows={7}
                  placeholder={
                    'Tempel data dari Excel di sini (Ctrl+V)…\n\nNIS\tNama\tKelas\tProgram\tHalaqoh\n2025001\tAhmad Fauzan\t7A\tTahfidz Al-Quran\tHalaqoh 1'
                  }
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Blok data di Excel → Copy (Ctrl+C) → tempel di sini. Kolom urut:{' '}
                  <span className="font-mono">NIS, Nama, Kelas, Program, Halaqoh</span>. Baris
                  header dikenali otomatis. Tekan Ctrl+Enter atau tombol di bawah untuk memproses.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePasteParse}
                  disabled={parsing || !pasteText.trim()}
                  className="min-h-11 sm:min-h-9"
                >
                  Proses Data Tempelan
                </Button>
              </TabsContent>
            </Tabs>

            {/* ===== Preview hasil parse ===== */}
            {parsing ? (
              <LoadingBlock label="Memproses data…" />
            ) : parsedRows.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    {validCount} siap impor
                  </Badge>
                  {errorCount > 0 ? (
                    <Badge variant="destructive">{errorCount} ditolak</Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    Periksa pratinjau sebelum mengimpor.
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border [scrollbar-width:thin]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-3">No</TableHead>
                        <TableHead>NIS</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead className="pr-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((r) => (
                        <TableRow key={r.row} className={r.status === 'error' ? 'bg-destructive/5' : ''}>
                          <TableCell className="pl-3 text-sm text-muted-foreground">{r.row}</TableCell>
                          <TableCell className="font-mono text-sm">{r.nis || '—'}</TableCell>
                          <TableCell className="max-w-36 truncate text-sm" title={r.nama}>
                            {r.nama || '—'}
                          </TableCell>
                          <TableCell className="text-sm">{r.kelas || '—'}</TableCell>
                          <TableCell className="max-w-36 truncate text-sm" title={r.program}>
                            {r.program || '—'}
                          </TableCell>
                          <TableCell className="pr-3">
                            {r.status === 'ok' ? (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                Valid
                              </Badge>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {r.reason}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
            className="min-h-11 sm:min-h-9"
          >
            {result ? 'Tutup' : 'Batal'}
          </Button>
          {!result ? (
            <Button
              type="button"
              onClick={doImport}
              disabled={importing || validCount === 0}
              className="min-h-11 sm:min-h-9"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {validCount} Data Valid
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
