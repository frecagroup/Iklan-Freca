'use client'

// Gaya DateRangeFilter Absensi: chip preset + input tanggal "Dari / Sampai"
import { PRESETS, useDashboard } from '@/lib/data'
import { tanggal, todayWIB } from '@/lib/format'
import { cn } from '@/lib/cn'

export function PeriodFilter() {
  const { preset, setPreset, custom, setCustom, range } = useDashboard()
  const today = todayWIB()

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setPreset(k)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                preset === k ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {l}
              {k === 'today' && preset === k && <span className="ml-1 text-[11px] font-normal opacity-90">(berjalan)</span>}
            </button>
          ))}
          <button
            onClick={() => setPreset('custom')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              preset === 'custom' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            Custom
          </button>
        </div>

        {preset === 'custom' && (
          <div className="flex w-full items-end gap-2 sm:ml-auto sm:w-auto">
            <label className="block flex-1 sm:flex-none">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Dari</span>
              <input
                type="date"
                value={custom.from}
                max={custom.to || today}
                onChange={(e) => e.target.value && setCustom({ from: e.target.value, to: custom.to })}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <label className="block flex-1 sm:flex-none">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Sampai</span>
              <input
                type="date"
                value={custom.to}
                min={custom.from}
                max={today}
                onChange={(e) => e.target.value && setCustom({ from: custom.from, to: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </label>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Periode: <span className="font-medium text-foreground">{range.from === range.to ? tanggal(range.from) : `${tanggal(range.from)} – ${tanggal(range.to)}`}</span>
        {preset === 'today' && ' · data hari ini masih berjalan'}
      </p>
    </div>
  )
}
