'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Card } from './ui'
import { WarnBadge } from './metrics-view'
import { percent, rupiah } from '@/lib/format'
import { brandSlug, warningReason, type ProductTotals } from '@/lib/metrics'
import { cn } from '@/lib/cn'

/** Daftar produk yang perlu dicek (NPM < 10% atau profit negatif) */
export function WarningList({ items }: { items: ProductTotals[] }) {
  const [open, setOpen] = useState(items.length <= 5)
  const shown = open ? items : items.slice(0, 5)
  return (
    <Card className="border-destructive/30 p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/12 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-foreground">Perlu dicek</h2>
          <p className="text-xs text-muted-foreground">{items.length} produk NPM &lt; 10% atau rugi</p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {shown.map((p) => (
          <li key={`${p.brand}-${p.product}`}>
            <Link href={`/brand/${brandSlug(p.brand)}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.product}</p>
                <p className="text-xs text-muted-foreground">{p.brand}</p>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-semibold tabular-nums', p.profit < 0 ? 'text-destructive' : 'text-foreground')}>{rupiah(p.profit)}</p>
                <p className="text-xs tabular-nums text-muted-foreground">NPM {percent(p.npm)}</p>
              </div>
              <WarnBadge>{warningReason(p)}</WarnBadge>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm font-medium text-primary hover:bg-muted"
        >
          {open ? 'Tampilkan lebih sedikit' : `Lihat semua (${items.length})`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    </Card>
  )
}
