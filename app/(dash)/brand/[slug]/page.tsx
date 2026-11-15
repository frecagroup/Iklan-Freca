'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PeriodFilter } from '@/components/period-filter'
import { BrandTabs, brandHref } from '@/components/brand-tabs'
import { ProductTable } from '@/components/product-table'
import { ErrorBox, ProfitNote, WarnBadge } from '@/components/metrics-view'
import { useAdsRows, useDashboard } from '@/lib/data'
import { brandFromSlug, groupByProduct, isWarning, sumRows } from '@/lib/metrics'

export default function BrandPage() {
  const { slug } = useParams<{ slug: string }>()
  const brand = brandFromSlug(slug) ?? decodeURIComponent(slug)
  const { range } = useDashboard()
  const { rows, error } = useAdsRows(range, brand)

  const data = useMemo(() => {
    if (!rows) return null
    const items = groupByProduct(rows)
    return { items, summary: sumRows(rows), warn: items.filter((p) => p.spend + p.gmv > 0 && isWarning(p)).length }
  }, [rows])

  return (
    <div className="space-y-4">
      <BrandTabs active={brand} hrefOf={brandHref} />
      <PeriodFilter />
      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-foreground">{brand}</h2>
        {data && <span className="text-sm text-muted-foreground">{data.items.length} produk</span>}
        {data && data.warn > 0 && (
          <WarnBadge>{data.warn} perlu dicek</WarnBadge>
        )}
        <Link href="/tren" className="ml-auto text-sm font-medium text-primary hover:underline">
          Lihat tren →
        </Link>
      </div>

      {data ? (
        <ProductTable items={data.items} summary={data.summary} />
      ) : (
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      )}
      <p className="text-xs text-muted-foreground">Ketuk judul kolom untuk mengurutkan. Geser tabel ke samping di HP.</p>
      <ProfitNote />
    </div>
  )
}
