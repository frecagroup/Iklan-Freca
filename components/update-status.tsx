'use client'

import { RefreshCw } from 'lucide-react'
import { useDashboard } from '@/lib/data'
import { jamWIB, tanggal, todayWIB } from '@/lib/format'
import { cn } from '@/lib/cn'

function isOk(status: string | null | undefined) {
  if (!status) return true
  return /^(ok|success|sukses|done|berhasil)$/i.test(status.trim())
}

export function UpdateStatus({ compact = false }: { compact?: boolean }) {
  const { sync, lastFetched, today } = useDashboard()
  if (!sync?.last_run) {
    return <span className="text-xs text-muted-foreground">{compact ? '—' : 'Update terakhir: —'}</span>
  }
  const d = new Date(sync.last_run)
  const day = todayWIB(d)
  const sameDay = day === today
  const label = `${sameDay ? '' : `${tanggal(day, false)} `}${jamWIB(d)} WIB`
  const ok = isOk(sync.status)
  // > 3x jadwal 15 menit, diukur saat status terakhir diambil
  const stale = lastFetched !== null && lastFetched.getTime() - d.getTime() > 45 * 60 * 1000

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium', ok && !stale ? 'text-muted-foreground' : 'text-destructive')}
      title={[sync.status, sync.note].filter(Boolean).join(' — ') || undefined}
    >
      <span className={cn('h-2 w-2 rounded-full', ok && !stale ? 'animate-pulse-dot bg-success' : 'bg-destructive')} />
      {compact ? label : `Update terakhir: ${label}`}
      {!compact && !ok && <span className="rounded bg-destructive/10 px-1.5 py-0.5">{sync.status}</span>}
    </span>
  )
}

export function RefreshButton({ withLabel = false }: { withLabel?: boolean }) {
  const { refresh, refreshing } = useDashboard()
  return (
    <button
      onClick={refresh}
      disabled={refreshing}
      aria-label="Refresh data"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60',
        withLabel ? 'h-9 border border-input bg-background px-3' : 'h-9 w-9',
      )}
    >
      <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
      {withLabel && 'Refresh'}
    </button>
  )
}
