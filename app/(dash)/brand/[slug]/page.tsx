'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PeriodFilter } from '@/components/period-filter'
import { BrandTabs, brandHref } from '@/components/brand-tabs'
import { ProductTable } from '@/components/product-table'
import { CreativePanel } from '@/components/creative-panel'
import { ErrorBox, ProfitNote, WarnBadge } from '@/components/metrics-view'
import { LastUpdate, useSyncHealth } from '@/components/update-status'
import { useAdsRows, useDashboard, useQuery } from '@/lib/data'
import { brandFromSlug, groupByProduct, isWarning, sumRows, type ProductTotals } from '@/lib/metrics'
import { fetchCprTargets, fetchIsCreativeEditor } from '@/lib/creative'

export default function BrandPage() {
  const { slug } = useParams<{ slug: string }>()
  const brand = brandFromSlug(slug) ?? decodeURIComponent(slug)
  const { range } = useDashboard()
  const { rows, error } = useAdsRows(range, brand)
  const sync = useSyncHealth()

  // hak on/off creative + ubah target CPR (BUKAN editor HPP). Gagal cek = baca saja.
  const creativeEditor = useQuery('creative-editor', fetchIsCreativeEditor)
  const canEditCreative = creativeEditor.data === true

  const [targetVer, setTargetVer] = useState(0)
  const targets = useQuery(`cpr-target|${brand}|${targetVer}`, () => fetchCprTargets(brand), { keepPrevious: true })
  const onTargetSaved = useCallback(() => setTargetVer((v) => v + 1), [])

  const data = useMemo(() => {
    if (!rows) return null
    const items = groupByProduct(rows)
    return { items, summary: sumRows(rows), warn: items.filter((p) => p.spend + p.gmv > 0 && isWarning(p)).length }
  }, [rows])

  const renderDetail = useCallback(
    (p: ProductTotals) => (
      <CreativePanel
        brand={brand}
        product={p.product}
        target={targets.data?.[p.product] ?? null}
        canEdit={canEditCreative}
        onTargetSaved={onTargetSaved}
        targetVersion={targetVer}
      />
    ),
    [brand, targets.data, canEditCreative, onTargetSaved, targetVer],
  )

  return (
    <div className="space-y-4">
      <BrandTabs active={brand} hrefOf={brandHref} />
      <PeriodFilter />
      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-lg font-bold text-foreground">{brand}</h2>
        {data && <span className="text-sm text-muted-foreground">{data.items.length} produk</span>}
        {data && data.warn > 0 && <WarnBadge>{data.warn} perlu dicek</WarnBadge>}
        <Link href="/tren" className="ml-auto text-sm font-medium text-primary hover:underline">
          Lihat tren →
        </Link>
        <div className="basis-full">
          <LastUpdate
            ts={sync.sync?.last_run ?? null}
            danger={!sync.healthy}
            title={[sync.sync?.status, sync.sync?.note].filter(Boolean).join(' — ') || undefined}
          />
          {!sync.ok && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">{sync.sync?.status}</span>}
        </div>
      </div>

      {data ? (
        <ProductTable items={data.items} summary={data.summary} renderDetail={renderDetail} />
      ) : (
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      )}
      <p className="text-xs text-muted-foreground">
        Ketuk baris produk untuk melihat video GMV Max. Ketuk judul kolom untuk mengurutkan. Geser tabel ke samping di HP.
      </p>
      <ProfitNote />
    </div>
  )
}
