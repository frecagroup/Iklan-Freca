'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { selectClass } from './ui'
import { cn } from '@/lib/cn'

const intFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** Input Rupiah: ketik angka, tampil dengan titik ribuan (12.500). */
export function RupiahInput({
  value,
  onChange,
  placeholder = '0',
  autoFocus,
  disabled,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={value === null ? '' : intFmt.format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits ? Number(digits) : null)
        }}
        className={cn(selectClass(), 'pl-10 tabular-nums disabled:opacity-60')}
      />
    </div>
  )
}

/** Input persen desimal (boleh koma), 0–100. */
export function PercentInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        className={cn(selectClass(), 'pr-9 tabular-nums')}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
    </div>
  )
}

export function parsePercent(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Pilih tanggal; min default = hari ini (perubahan tidak boleh mundur). */
export function DateInput({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className={selectClass()}
    />
  )
}

export function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      rows={2}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(selectClass(), 'resize-none')}
    />
  )
}

/** Panel samping (desktop) / bottom sheet (HP) */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/50 backdrop-blur-sm sm:items-stretch" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full animate-rise flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:max-h-none sm:max-w-md sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 pt-[calc(1rem_+_env(safe-area-inset-top))] sm:pt-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{title}</p>
            {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

/** Tab pill (gaya BrandTabs) */
export function PillTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: Array<[T, ReactNode]>
}) {
  return (
    <div className="inline-flex gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm">
      {items.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            value === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

