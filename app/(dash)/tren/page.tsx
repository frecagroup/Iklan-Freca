'use client'

import { useMemo, useState } from 'react'
import { BrandTabs } from '@/components/brand-tabs'
import { DailyTable, MoneyChart, NpmChart, type DayPoint } from '@/components/trend-charts'
import { ErrorBox, ProfitNote } from '@/components/metrics-view'
import { useAdsRows, useDashboard } from '@/lib/data'
import { addDays, eachDay, tanggal } from '@/lib/format'
import { sumRows, type AdsRow, type Brand } from '@/lib/metrics'

export default function TrenPage() {
  const { today } = useDashboard()
  const [brand, setBrand] = useState<Brand | null>(null)

  // 30 hari terakhir (WIB), termasuk hari ini yang masih berjalan
  const range = useMemo(() => ({ from: addDays(today, -29), to: today }), [today])
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
        partial: d === range.to,
      }
    })
  }, [rows, range])

  return (
    <div className="space-y-4">
      <BrandTabs active={brand} onSelect={(b) => setBrand(b as Brand | null)} withAll />
      <p className="text-xs text-muted-foreground">
        {tanggal(range.from)} – {tanggal(range.to)} · {brand ?? 'Semua brand'}
      </p>
      {error && <ErrorBox message={error} />}
      {series ? (
        <>
          <MoneyChart data={series} />
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
