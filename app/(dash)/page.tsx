'use client'

import { useMemo } from 'react'
import { PeriodFilter } from '@/components/period-filter'
import { BrandCard, ErrorBox, GrandTotal, ProfitNote, SkeletonGrid } from '@/components/metrics-view'
import { WarningList } from '@/components/warning-list'
import { useAdsRows, useDashboard } from '@/lib/data'
import { BRANDS, brandSlug, filterBrand, groupByProduct, isWarning, sumRows } from '@/lib/metrics'

export default function RingkasanPage() {
  const { range } = useDashboard()
  const { rows, error } = useAdsRows(range)

  const data = useMemo(() => {
    if (!rows) return null
    const products = groupByProduct(rows)
    // brand di luar daftar tetap ikut ditampilkan (kalau VPS menambah brand baru)
    const extra = [...new Set(rows.map((r) => r.brand))].filter((b) => !(BRANDS as readonly string[]).includes(b))
    const brands = [...BRANDS, ...extra].map((b) => ({
      brand: b,
      t: sumRows(filterBrand(rows, b)),
      warn: products.filter((p) => p.brand === b && p.spend + p.gmv > 0 && isWarning(p)).length,
    }))
    const warnings = products.filter((p) => p.spend + p.gmv > 0 && isWarning(p)).sort((a, b) => a.profit - b.profit)
    return { total: sumRows(rows), brands, warnings }
  }, [rows])

  return (
    <div className="space-y-5">
      <PeriodFilter />
      {error && <ErrorBox message={error} />}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Grand Total</h2>
        {data ? <GrandTotal t={data.total} /> : <SkeletonGrid />}
      </section>

      {data && data.warnings.length > 0 && <WarningList items={data.warnings} />}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Per Brand</h2>
        {data ? (
          <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
            {data.brands.map((b) => (
              <BrandCard key={b.brand} brand={b.brand} href={`/brand/${brandSlug(b.brand)}`} t={b.t} warnCount={b.warn} />
            ))}
          </div>
        ) : (
          <SkeletonGrid count={4} className="h-40 col-span-2" />
        )}
      </section>

      <ProfitNote />
    </div>
  )
}
