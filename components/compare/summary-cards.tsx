'use client'

import { AlertTriangle, CircleDollarSign, Megaphone, Percent, ShoppingCart, Target, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import { fmtDelta, fmtPct, fmtValue, METRICS, METRIC_LABEL, trend, trendClass, type CompareRow, type Metric } from '@/lib/compare'
import { cn } from '@/lib/cn'

const ICON: Record<Metric, LucideIcon> = {
  gmv: CircleDollarSign,
  orders: ShoppingCart,
  spend: Megaphone,
  cpr: Megaphone,
  roas: TrendingUp,
  profit: Wallet,
  poas: Target,
  npm: Percent,
}

const PROFIT_BASED: Metric[] = ['profit', 'poas', 'npm']

/** Kartu ringkasan dari baris summary: A, B, perubahan (hijau = membaik, merah = memburuk) */
export function CompareSummaryCards({ row, labelA, labelB }: { row: CompareRow; labelA: string; labelB: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {METRICS.map((m) => {
        const Icon = ICON[m]
        const t = trend(m, row.d[m])
        const incomplete = PROFIT_BASED.includes(m) && (row.a_profit_incomplete > 0 || row.b_profit_incomplete > 0)
        return (
          <div key={m} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-sm md:p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex rounded-lg bg-primary/10 p-1.5 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-xs font-semibold text-muted-foreground">
                {METRIC_LABEL[m]}
                {m === 'profit' && <span className="ml-1 font-normal opacity-80">(estimasi)</span>}
              </p>
              {incomplete && (
                <span title="Profit belum lengkap: ada baris tanpa HPP" className="ml-auto text-warning">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              )}
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-muted-foreground">A · {labelA}</span>
                <span className="whitespace-nowrap font-medium tabular-nums text-foreground">{fmtValue(m, row.a[m])}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-muted-foreground">B · {labelB}</span>
                <span className="whitespace-nowrap text-sm font-bold tabular-nums text-foreground md:text-base">{fmtValue(m, row.b[m])}</span>
              </div>
            </div>
            <div className={cn('mt-2 flex flex-wrap items-baseline justify-between gap-x-2 border-t border-border pt-2 text-xs font-semibold tabular-nums', trendClass(t))}>
              <span className="whitespace-nowrap">{fmtPct(row.pct[m], row.a[m], row.b[m])}</span>
              <span className="whitespace-nowrap font-medium">{fmtDelta(m, row.d[m])}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
