'use client'

/**
 * Helper UI bersama untuk seluruh section dashboard (dipakai agent 3-a/3-b/3-c).
 * Kontrak props TIDAK boleh diubah tanpa koordinasi.
 */
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getNilaiVariant } from '@/lib/format'
import type { TipeInputan } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/** Header standar tiap section: judul + deskripsi di kiri, aksi di kanan (children). */
export function SectionHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-col sm:flex-row gap-2">{children}</div> : null}
    </div>
  )
}

/** Kartu statistik kecil (grid ringkasan). */
export function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: string | number
  icon?: ReactNode
  hint?: string
}) {
  return (
    <Card className="gap-0 p-4 sm:p-6">
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground p-2 [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </span>
        ) : null}
        <span className="text-sm text-muted-foreground leading-snug">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </Card>
  )
}

/** Kotak kosong / data belum ada. */
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="py-12 text-center">
      {icon ? (
        <div className="rounded-full bg-muted p-4 w-fit mx-auto text-muted-foreground/50 [&_svg]:h-10 [&_svg]:w-10">
          {icon}
        </div>
      ) : null}
      <p className="font-medium mt-4">{title}</p>
      {description ? (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>
      ) : null}
      {children ? <div className="mt-4 flex justify-center">{children}</div> : null}
    </div>
  )
}

/**
 * Dialog konfirmasi destructive.
 * CATATAN: AlertDialogAction di-preventDefault agar dialog tetap terbuka saat `loading`
 * (tampilkan spinner); pemanggil wajib menutup dialog via `onOpenChange(false)`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmText ?? 'Hapus'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Label form + input (children) + hint opsional. */
export function Field({
  label,
  required,
  hint,
  children,
  htmlFor,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

const TIPE_BADGE_CLASS: Record<TipeInputan, string> = {
  A: 'bg-secondary text-secondary-foreground border-transparent',
  B: 'bg-primary/10 text-primary border-primary/20',
  C: 'bg-primary text-primary-foreground border-transparent',
  D: 'bg-emerald-800/10 text-emerald-900 border-emerald-800/20',
}

/** Badge tipe form (Type A/B/C/D) dengan palet hijau/netral. */
export function TipeBadge({ tipe }: { tipe: 'A' | 'B' | 'C' | 'D' }) {
  return (
    <Badge variant="outline" className={cn('rounded-md font-semibold', TIPE_BADGE_CLASS[tipe])}>
      Type {tipe}
    </Badge>
  )
}

/** Badge nilai kelancaran (mis. "A - Sangat Baik"); null/undefined → tidak dirender. */
export function NilaiBadge({ nilai }: { nilai?: string | null }) {
  if (!nilai) return null
  return (
    <Badge variant={getNilaiVariant(nilai)} className="whitespace-nowrap">
      {nilai}
    </Badge>
  )
}

/** Indikator memuat standar. */
export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label ?? 'Memuat…'}</p>
    </div>
  )
}
