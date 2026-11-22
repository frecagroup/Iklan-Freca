'use client'

import { RefreshCw } from 'lucide-react'
import { useDashboard } from '@/lib/data'
import { jamWIB, tanggal, todayWIB } from '@/lib/format'
import { cn } from '@/lib/cn'

function isOk(status: string | null | undefined) {
  if (!status) return true
  return /^(ok|success|sukses|done|berhasil)$/i.test(status.trim())
}

/** Sync VPS tiap 5 menit → dianggap terlambat bila > 3× jadwal (15 menit) */
export const SYNC_STALE_MS = 15 * 60 * 1000

/** "HH:MM WIB", diawali tanggal bila bukan hari ini */
export function updateTimeLabel(ts: string | Date, today: string): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  const day = todayWIB(d)
  return `${day === today ? '' : `${tanggal(day, false)} `}${jamWIB(d)} WIB`
}

/** Kesehatan sync VPS dari sync_status (dipakai header & halaman brand) */
export function useSyncHealth() {
  const { sync, lastFetched, today } = useDashboard()
  if (!sync?.last_run) return { label: null as string | null, ok: true, stale: false, healthy: true, sync }
  const d = new Date(sync.last_run)
  const ok = isOk(sync.status)
  // diukur saat status terakhir diambil (bukan jam render) supaya tetap murni
  const stale = lastFetched !== null && lastFetched.getTime() - d.getTime() > SYNC_STALE_MS
  return { label: updateTimeLabel(d, today), ok, stale, healthy: ok && !stale, sync }
}

/** Label "Terakhir update: HH:MM WIB"; merah bila sync tidak sehat */
export function LastUpdate({
  ts,
  danger = false,
  title,
  className,
}: {
  ts: string | null
  danger?: boolean
  title?: string
  className?: string
}) {
  const { today } = useDashboard()
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium', danger ? 'text-destructive' : 'text-muted-foreground', className)}
      title={title}
    >
      <span className={cn('h-2 w-2 rounded-full', danger ? 'bg-destructive' : 'bg-success')} />
      Terakhir update: {ts ? updateTimeLabel(ts, today) : '—'}
    </span>
  )
}

export function UpdateStatus({ compact = false }: { compact?: boolean }) {
  const { sync, label: timeLabel, ok, stale } = useSyncHealth()
  if (!sync?.last_run || !timeLabel) {
    return <span className="text-xs text-muted-foreground">{compact ? '—' : 'Update terakhir: —'}</span>
  }
  const label = timeLabel

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
