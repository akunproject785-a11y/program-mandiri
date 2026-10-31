'use client'

/**
 * Menampilkan catatan setoran terakhir seorang siswa untuk SEMUA jenis
 * (Ziyadah/Murojaah/Tilawah untuk tipe C-D; Anaba untuk tipe A; Materi untuk
 * tipe B) — agar musyrif tahu titik lanjutan setoran berikutnya.
 *
 * Variant:
 *  - "row"   : ringkas, untuk baris daftar siswa (langkah 3 Input Setoran).
 *  - "panel" : panel detail dengan nilai, dipakai di popup input setoran.
 *
 * Opsi aksi (hanya variant "panel"): jika `onEdit`/`onDelete` disediakan,
 * setiap entri menampilkan tombol ikon edit/hapus. Tombol hanya dirender pada
 * entri yang lolos `canManage` (admin: semua; musyrif: rekamannya sendiri).
 */
import { History, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { describeSetoranLanjutan, formatTanggalIndo, formatTanggalPendek } from '@/lib/format'
import type { SetoranItem, SiswaTerakhirInfo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { NilaiBadge } from '@/components/dashboard/ui-helpers'

/** Warna titik penanda per jenis (palet hijau/netral). */
const JENIS_DOT: Record<string, string> = {
  Ziyadah: 'bg-emerald-500',
  Murojaah: 'bg-amber-500',
  Tilawah: 'bg-teal-500',
  Anaba: 'bg-primary',
  Materi: 'bg-primary',
}

function jenisDotClass(jenis: string): string {
  return JENIS_DOT[jenis] ?? 'bg-primary'
}

export default function SetoranTerakhirList({
  info,
  variant = 'row',
  className,
  canManage,
  onEdit,
  onDelete,
}: {
  info?: SiswaTerakhirInfo | null
  variant?: 'row' | 'panel'
  className?: string
  /** Predikat izin kelola (edit/hapus) satu entri — tanpa ini, semua entri dianggap boleh. */
  canManage?: (item: SetoranItem) => boolean
  /** Disediakan → tampilkan tombol edit per entri (variant panel). */
  onEdit?: (item: SetoranItem) => void
  /** Disediakan → tampilkan tombol hapus per entri (variant panel). */
  onDelete?: (item: SetoranItem) => void
}) {
  const entries = info?.perJenis ?? []
  const hasActions = Boolean(onEdit || onDelete)
  const manageable = (item: SetoranItem) =>
    hasActions && (!canManage || canManage(item))

  if (entries.length === 0) {
    if (variant === 'panel') {
      return (
        <div className={cn('rounded-lg border border-dashed bg-muted/30 p-3', className)}>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground/70">
            <History className="h-3.5 w-3.5" aria-hidden />
            Belum ada setoran
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ini akan menjadi catatan setoran pertama siswa ini.
          </p>
        </div>
      )
    }
    return (
      <p className={cn('text-xs italic text-muted-foreground/80', className)}>
        Belum ada setoran
      </p>
    )
  }

  // ===== Variant panel (popup input setoran) =====
  if (variant === 'panel') {
    return (
      <div className={cn('rounded-lg border bg-secondary/40 p-3', className)}>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary-foreground/90">
          <History className="h-3.5 w-3.5" aria-hidden />
          Setoran Terakhir — semua jenis (titik lanjutan)
        </p>
        <ul className="mt-2.5 space-y-2.5">
          {entries.map((e) => (
            <li
              key={e.jenis}
              className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', jenisDotClass(e.jenis))}
                      aria-hidden
                    />
                    {e.jenis}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    • {formatTanggalIndo(e.setoran.tanggal)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {describeSetoranLanjutan(e.setoran)}
                  {e.setoran.catatanMusyrif ? ` — ${e.setoran.catatanMusyrif}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <NilaiBadge nilai={e.setoran.nilai ?? e.setoran.nilaiKelancaran} />
                {manageable(e.setoran) ? (
                  <div className="flex items-center gap-0.5">
                    {onEdit ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit setoran ${e.jenis}`}
                        title="Edit setoran ini"
                        onClick={() => onEdit(e.setoran)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus setoran ${e.jenis}`}
                        title="Hapus setoran ini"
                        onClick={() => onDelete(e.setoran)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // ===== Variant row (baris daftar siswa) =====
  return (
    <ul className={cn('mt-1.5 space-y-1', className)}>
      {entries.map((e) => (
        <li key={e.jenis} className="flex items-start gap-1.5 text-xs leading-snug">
          <span
            className={cn('mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full', jenisDotClass(e.jenis))}
            aria-hidden
          />
          <span className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-semibold text-foreground/75">{e.jenis}:</span>{' '}
            {describeSetoranLanjutan(e.setoran)}
            <span className="text-muted-foreground/70">
              {' '}
              • {formatTanggalPendek(e.setoran.tanggal)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
