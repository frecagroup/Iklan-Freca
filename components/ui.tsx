// Komponen UI — disalin dari web Absensi Freca (frecagroup/absensi) supaya tampilan identik
'use client'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Loader2, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin', className)} />
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0'
  const variants: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
    outline: 'border border-input bg-background hover:bg-muted',
    ghost: 'hover:bg-muted',
    destructive: 'bg-destructive text-white hover:bg-destructive/90 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  }
  const sizes: Record<string, string> = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  }
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card shadow-sm', className)}>{children}</div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string }

export function Input({ label, className = '', ...rest }: InputProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>}
      <input
        className={cn(
          'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/40',
          className,
        )}
        {...rest}
      />
    </label>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

export function selectClass() {
  return 'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40'
}

type Tone = 'success' | 'warning' | 'destructive' | 'primary' | 'neutral'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    success: 'bg-success/12 text-success border-success/20',
    warning: 'bg-warning/15 text-warning border-warning/25',
    destructive: 'bg-destructive/12 text-destructive border-destructive/20',
    primary: 'bg-primary/12 text-primary-dark border-primary/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:h-3 [&_svg]:w-3',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
}) {
  if (!open) return null
  const maxW = size === 'xl' ? 'sm:max-w-3xl' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'flex max-h-[92vh] w-full animate-rise flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl',
          maxW,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <span className="text-base font-semibold text-foreground">{title}</span>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-5">{children}</div>
        {footer && <div className="flex-shrink-0 border-t border-border bg-card px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

type StatVariant = 'blue' | 'green' | 'amber' | 'red' | 'purple'

const statConfig: Record<StatVariant, { card: string; icon: string; value: string }> = {
  blue: {
    card: 'bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-blue-500/5 border-blue-500/20',
    icon: 'bg-blue-500/15 text-blue-600',
    value: 'text-blue-700',
  },
  green: {
    card: 'bg-gradient-to-br from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    icon: 'bg-emerald-500/15 text-emerald-600',
    value: 'text-emerald-700',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-amber-500/5 border-amber-500/20',
    icon: 'bg-amber-500/15 text-amber-600',
    value: 'text-amber-700',
  },
  red: {
    card: 'bg-gradient-to-br from-red-500/5 via-red-500/10 to-red-500/5 border-red-500/20',
    icon: 'bg-red-500/15 text-red-600',
    value: 'text-red-700',
  },
  purple: {
    card: 'bg-gradient-to-br from-purple-500/5 via-purple-500/10 to-purple-500/5 border-purple-500/20',
    icon: 'bg-purple-500/15 text-purple-600',
    value: 'text-purple-700',
  },
}

export function StatCard({
  label,
  value,
  icon: Icon,
  variant,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  variant: StatVariant
}) {
  const c = statConfig[variant]
  return (
    <div className={cn('overflow-hidden rounded-xl border p-5', c.card)}>
      <div className={cn('mb-3 inline-flex rounded-lg p-2', c.icon)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('text-3xl font-bold tracking-tight tabular-nums', c.value)}>{value}</p>
    </div>
  )
}