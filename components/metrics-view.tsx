'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ChevronRight,
  CircleDollarSign,
  Info,
  Megaphone,
  Percent,
  ShoppingCart,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Card } from './ui'
import { decimal, integer, percent, rupiah } from '@/lib/format'
import { isWarning, NPM_THRESHOLD, type Totals } from '@/lib/metrics'
import { cn } from '@/lib/cn'

type Variant = 'blue' | 'green' | 'amber' | 'red' | 'purple'

// Sama dengan StatCard Absensi, dengan ukuran angka disesuaikan untuk Rupiah panjang
const statConfig: Record<Variant, { card: string; icon: string; value: string }> = {
  blue: {
    card: 'bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-blue-500/5 border-blue-500/20',
    icon: 'bg-blue-500/15 text-blue-600',
    value: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    card: 'bg-gradient-to-br from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    icon: 'bg-emerald-500/15 text-emerald-600',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-amber-500/5 border-amber-500/20',
    icon: 'bg-amber-500/15 text-amber-600',
    value: 'text-amber-700 dark:text-amber-300',
  },
  red: {
    card: 'bg-gradient-to-br from-red-500/5 via-red-500/10 to-red-500/5 border-red-500/20',
    icon: 'bg-red-500/15 text-red-600',
    value: 'text-red-700 dark:text-red-300',
  },
  purple: {
    card: 'bg-gradient-to-br from-purple-500/5 via-purple-500/10 to-purple-500/5 border-purple-500/20',
    icon: 'bg-purple-500/15 text-purple-600',
    value: 'text-purple-700 dark:text-purple-300',
  },
}

function StatCard({ label, value, icon: Icon, variant, hint }: { label: string; value: string; icon: LucideIcon; variant: Variant; hint?: string }) {
  const c = statConfig[variant]
  return (
    <div className={cn('min-w-0 overflow-hidden rounded-xl border p-3.5 md:p-5', c.card)}>
      <div className={cn('mb-2 inline-flex rounded-lg p-1.5 md:mb-3 md:p-2', c.icon)}>
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-[10px] font-normal opacity-80">({hint})</span>}
      </p>
      <p
        className={cn(
          'whitespace-nowrap font-bold leading-tight tracking-tight tabular-nums sm:text-xl md:text-2xl',
          // angka Rupiah miliaran tetap satu baris di HP
          value.length >= 14 ? 'text-[15px]' : value.length >= 12 ? 'text-base' : 'text-lg',
          c.value,
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** Kartu Grand Total: GMV, Spend, ROAS, Profit, POAS, NPM, Order, CPR */
export function GrandTotal({ t }: { t: Totals }) {
  const lowNpm = t.npm !== null && t.npm < NPM_THRESHOLD
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard label="GMV" value={rupiah(t.gmv)} icon={CircleDollarSign} variant="blue" />
      <StatCard label="Spend Iklan" value={rupiah(t.spend)} icon={Megaphone} variant="amber" />
      <StatCard label="ROAS" value={decimal(t.roas)} icon={TrendingUp} variant="purple" />
      <StatCard label="Profit" hint="estimasi" value={rupiah(t.profit)} icon={Wallet} variant={t.profit < 0 ? 'red' : 'green'} />
      <StatCard label="POAS" value={decimal(t.poas)} icon={Target} variant={t.poas !== null && t.poas < 0 ? 'red' : 'purple'} />
      <StatCard label="NPM" value={percent(t.npm)} icon={Percent} variant={lowNpm || t.profit < 0 ? 'red' : 'green'} />
      <StatCard label="Order" value={integer(t.orders)} icon={ShoppingCart} variant="blue" />
      <StatCard label="CPR" value={rupiah(t.cpr)} icon={Megaphone} variant="amber" />
    </div>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'good' }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-semibold tabular-nums',
          tone === 'bad' ? 'text-destructive' : tone === 'good' ? 'text-success' : 'text-foreground',
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

/** Satu kartu per brand dengan 8 angka yang sama */
export function BrandCard({ brand, href, t, warnCount }: { brand: string; href: string; t: Totals; warnCount: number }) {
  const lowNpm = t.npm !== null && t.npm < NPM_THRESHOLD
  const empty = t.orders === 0 && t.gmv === 0 && t.spend === 0
  return (
    <Link href={href} className="group block">
      <Card className="h-full p-4 transition-colors group-hover:border-primary/40 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">{brand}</h3>
          {warnCount > 0 && (
            <WarnBadge>
              {warnCount} produk perlu dicek
            </WarnBadge>
          )}
          {!empty && isWarning(t) && warnCount === 0 && <WarnBadge>{t.profit < 0 ? 'Rugi' : 'NPM < 10%'}</WarnBadge>}
          <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
        {empty ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Belum ada data di periode ini.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Mini label="GMV" value={rupiah(t.gmv)} />
            <Mini label="Spend" value={rupiah(t.spend)} />
            <Mini label="ROAS" value={decimal(t.roas)} />
            <Mini label="Profit*" value={rupiah(t.profit)} tone={t.profit < 0 ? 'bad' : undefined} />
            <Mini label="POAS" value={decimal(t.poas)} tone={t.poas !== null && t.poas < 0 ? 'bad' : undefined} />
            <Mini label="NPM" value={percent(t.npm)} tone={lowNpm || t.profit < 0 ? 'bad' : undefined} />
            <Mini label="Order" value={integer(t.orders)} />
            <Mini label="CPR" value={rupiah(t.cpr)} />
          </div>
        )}
      </Card>
    </Link>
  )
}

export function ProfitNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
      <span>
        <b className="font-semibold text-foreground">Profit = estimasi.</b> Dihitung dari fee settlement riil, cancel/RTS 30 hari, dan HPP
        master. Spend sudah termasuk pajak 2%. Badge merah = NPM &lt; {NPM_THRESHOLD}% atau profit negatif.
      </span>
    </p>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <p className="font-semibold">Gagal memuat data</p>
        <p className="mt-0.5 break-words opacity-90">{message}</p>
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 8, className = 'h-28' }: { count?: number; className?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('animate-pulse rounded-xl border border-border bg-card', className)} />
      ))}
    </div>
  )
}

/** Badge peringatan merah (NPM < 10% / profit negatif) */
export function WarnBadge({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-destructive font-bold text-white',
        size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2.5 py-0.5 text-xs',
      )}
    >
      <AlertTriangle className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {children}
    </span>
  )
}
