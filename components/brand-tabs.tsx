'use client'

import Link from 'next/link'
import { BRANDS, brandSlug } from '@/lib/metrics'
import { cn } from '@/lib/cn'

/** Chip pilihan brand. hrefOf menentukan tujuan; null = "Semua". */
export function BrandTabs({
  active,
  hrefOf,
  onSelect,
  withAll = false,
}: {
  active: string | null
  hrefOf?: (brand: string) => string
  onSelect?: (brand: string | null) => void
  withAll?: boolean
}) {
  const items: Array<string | null> = withAll ? [null, ...BRANDS] : [...BRANDS]
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex w-max gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm">
        {items.map((b) => {
          const on = active === b
          const cls = cn(
            'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            on ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
          )
          const label = b ?? 'Semua'
          return hrefOf && b ? (
            <Link key={label} href={hrefOf(b)} className={cls} scroll={false}>
              {label}
            </Link>
          ) : (
            <button key={label} onClick={() => onSelect?.(b)} className={cls}>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const brandHref = (b: string) => `/brand/${brandSlug(b)}`
