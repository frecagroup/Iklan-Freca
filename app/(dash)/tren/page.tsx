'use client'

import { useMemo, useState } from 'react'
import { BrandTabs } from '@/components/brand-tabs'
import { DailyTable, MoneyChart, NpmChart, type DayPoint } from '@/components/trend-charts'
import { ErrorBox, ProfitNote } from '@/components/metrics-view'
import { useAdsRows, useDashboard } from '@/lib/data'
import { DateRangePicker, presetRange, type DateRange, type RangePresetKey } from '@/components/date-range-picker'
import { addDays, dayCount, eachDay, rangeLabelFull, tanggal } from '@/lib/format'
import { sumRows, type AdsRow, type Brand } from '@/lib/metrics'

export default function TrenPage() {
  const { today } = useDashboard()
  const [brand, setBrand] = useState<Brand | null>(null)
  // default 30 hari terakhir (WIB); preset relatif ikut bergeser bila lewat tengah malam
  const [pick, setPick] = useState<{ preset: RangePresetKey | null; range: DateRange }>({
    preset: '30',
    range: { from: addDays(today, -29), to: today },
  })
  const range = useMemo(() => (pick.preset ? presetRange(pick.preset, today) : pick.range), [pick, today])
  const { rows, error } = useAdsRows(range, brand)

  const series = useMemo<DayPoint[] | null>(() => {
    if (!rows) return null
    const byDate = new Map<string, AdsRow[]>()
    for (const r of rows) {
      const arr = byDate.get(r.date)
      if (arr) arr.push(r)
      else byDate.set(r.date, [r])
    }
    return eachDay(range.from, range.to).map((d) => {
      const t = sumRows(byDate.get(d) ?? [])
      return {
        date: d,
        label: tanggal(d, false),
        gmv: t.gmv,
        spend: t.spend,
        profit: t.profit,
        npm: t.npm,
        roas: t.roas,
        orders: t.orders,
        partial: d === today, // hari ini masih berjalan
      }
    })
  }, [rows, range, today])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <BrandTabs active={brand} onSelect={(b) => setBrand(b as Brand | null)} withAll />
        <DateRangePicker
          value={range}
          max={today}
          className="sm:ml-auto"
          buttonClassName="py-2"
          title="Periode grafik"
          onChange={(r, key) => setPick({ preset: key ?? null, range: r })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {rangeLabelFull(range.from, range.to)} · {dayCount(range.from, range.to)} hari · {brand ?? 'Semua brand'}
      </p>
      {error && <ErrorBox message={error} />}
      {series ? (
        <>
          <MoneyChart data={series} periodLabel={`${dayCount(range.from, range.to)} hari`} />
          <NpmChart data={series} />
          <DailyTable data={series} />
        </>
      ) : (
        <>
          <div className="h-80 animate-pulse rounded-xl border border-border bg-card md:h-96" />
          <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
        </>
      )}
      <ProfitNote />
    </div>
  )
}
