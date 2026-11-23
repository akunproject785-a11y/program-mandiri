import { cn } from '@/lib/utils'

/**
 * Logo lembaga (MIN 6 Sukoharjo) di dalam tile putih — dipakai di landing,
 * dialog login, sidebar desktop, dan topbar mobile. Ukuran diatur lewat
 * `className` (mis. "h-10 w-10"); bentuk tile mengikuti rounded-x/l dari caller.
 */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10',
        className,
      )}
    >
      <img
        src="/logo.png"
        alt="Logo MIN 6 Sukoharjo"
        className="h-full w-full object-contain p-[6%]"
        aria-hidden="true"
      />
    </span>
  )
}
