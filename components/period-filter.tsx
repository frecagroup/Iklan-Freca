'use client'

// Gaya DateRangeFilter Absensi: chip preset + satu kalender rentang (Custom)
import { PRESETS, useDashboard, type Preset } from '@/lib/data'
import { tanggal } from '@/lib/format'
import { DateRangePicker, type RangePresetKey } from './date-range-picker'
import { cn } from '@/lib/cn'

// preset di popup kalender yang punya chip sendiri
const CHIP_OF: Partial<Record<RangePresetKey, Preset>> = { today: 'today', yesterday: 'yesterday', '7': '7', '30': '30' }

export function PeriodFilter() {
  const { preset, setPreset, setCustom, range, today } = useDashboard()

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
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
        </div>
        <DateRangePicker
          value={range}
          max={today}
          active={preset === 'custom'}
          className="w-full sm:ml-auto sm:w-auto"
          title="Pilih periode"
          onChange={(r, key) => {
            const chip = key ? CHIP_OF[key] : undefined
            if (chip) setPreset(chip)
            else setCustom(r)
          }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Periode: <span className="font-medium text-foreground">{range.from === range.to ? tanggal(range.from) : `${tanggal(range.from)} – ${tanggal(range.to)}`}</span>
        {preset === 'today' && ' · data hari ini masih berjalan'}
      </p>
    </div>
  )
}
