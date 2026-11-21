'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react'
import { WarnBadge } from '../metrics-view'
import { selectClass } from '../ui'
import {
  fmtDelta,
  fmtPct,
  fmtValue,
  METRICS,
  METRIC_LABEL,
  sideTotals,
  trend,
  trendClass,
  type CompareRow,
  type Metric,
} from '@/lib/compare'
import { isWarning, warningReason } from '@/lib/metrics'
import { cn } from '@/lib/cn'

type Sub = 'a' | 'b' | 'd' | 'pct'
type SortKey = { col: 'name' } | { col: Metric; sub: Sub }

const rowName = (r: CompareRow) => r.product ?? r.brand ?? '—'

function sortValue(r: CompareRow, k: SortKey): number | string | null {
  if (k.col === 'name') return rowName(r)
  return r[k.sub][k.col]
}

/** Badge peringatan per sisi (NPM < 10% / rugi) */
function SideWarnings({ r }: { r: CompareRow }) {
  const out: Array<{ side: 'A' | 'B'; reason: string }> = []
  for (const s of ['a', 'b'] as const) {
    const t = sideTotals(r[s])
    if (t.gmv + t.spend > 0 && isWarning(t)) out.push({ side: s === 'a' ? 'A' : 'B', reason: warningReason(t)! })
  }
  if (!out.length) return null
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {out.map((w) => (
        <WarnBadge key={w.side} size="sm">
          {w.side} · {w.reason}
        </WarnBadge>
      ))}
    </span>
  )
}

function IncompleteIcon({ r }: { r: CompareRow }) {
  if (r.a_profit_incomplete <= 0 && r.b_profit_incomplete <= 0) return null
  const parts = [r.a_profit_incomplete > 0 && `A: ${r.a_profit_incomplete}`, r.b_profit_incomplete > 0 && `B: ${r.b_profit_incomplete}`]
    .filter(Boolean)
    .join(', ')
  return (
    <span title={`Profit belum lengkap — baris tanpa HPP (${parts})`} className="inline-flex text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
    </span>
  )
}

export function CompareTable({
  rows,
  labelA,
  labelB,
  level,
}: {
  rows: CompareRow[]
  labelA: string
  labelB: string
  level: 'product' | 'brand'
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: { col: 'gmv', sub: 'b' }, dir: 'desc' })
  const [open, setOpen] = useState<string | null>(null)

  const summary = rows.find((r) => r.row_type === 'summary') ?? null
  const body = useMemo(() => {
    const arr = rows.filter((r) => r.row_type !== 'summary')
    const m = sort.dir === 'asc' ? 1 : -1
    return arr.sort((x, y) => {
      const a = sortValue(x, sort.key)
      const b = sortValue(y, sort.key)
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      if (typeof a === 'string' || typeof b === 'string') return String(a).localeCompare(String(b), 'id') * m
      return (a - b) * m
    })
  }, [rows, sort])

  const setKey = (key: SortKey) =>
    setSort((s) => {
      const same = JSON.stringify(s.key) === JSON.stringify(key)
      return { key, dir: same ? (s.dir === 'desc' ? 'asc' : 'desc') : key.col === 'name' ? 'asc' : 'desc' }
    })
  const isActive = (key: SortKey) => JSON.stringify(sort.key) === JSON.stringify(key)
  const sortIcon = (k: SortKey) => {
    const cls = cn('h-3 w-3 flex-shrink-0', !isActive(k) && 'opacity-40')
    if (!isActive(k)) return <ArrowUpDown className={cls} />
    return sort.dir === 'asc' ? <ArrowUp className={cls} /> : <ArrowDown className={cls} />
  }

  const firstCol = level === 'product' ? 'Produk' : 'Toko'
  const subLabel: Record<Sub, string> = { a: labelA, b: labelB, d: 'Δ', pct: '%' }

  // ---- sel metrik untuk satu baris ----
  const cells = (r: CompareRow, bold = false) =>
    METRICS.map((m) => {
      const t = trend(m, r.d[m])
      return [
        <td key={`${m}a`} className={cn('whitespace-nowrap border-l border-border/60 px-2.5 py-2 text-right tabular-nums text-muted-foreground', bold && 'font-bold text-foreground')}>
          {fmtValue(m, r.a[m])}
        </td>,
        <td key={`${m}b`} className={cn('whitespace-nowrap px-2.5 py-2 text-right tabular-nums text-foreground', bold && 'font-bold')}>
          {fmtValue(m, r.b[m])}
        </td>,
        <td key={`${m}d`} className={cn('whitespace-nowrap px-2.5 py-2 text-right tabular-nums', trendClass(t), bold && 'font-bold')}>
          {fmtDelta(m, r.d[m])}
        </td>,
        <td key={`${m}p`} className={cn('whitespace-nowrap px-2.5 py-2 text-right tabular-nums', trendClass(t), bold && 'font-bold')}>
          {fmtPct(r.pct[m], r.a[m], r.b[m])}
        </td>,
      ]
    })

  return (
    <>
      {/* -------- Desktop: tabel side-by-side A | B | Δ | % -------- */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th rowSpan={2} className="sticky-col min-w-[200px] bg-muted px-3 py-2 text-left align-bottom font-semibold text-muted-foreground">
                  <button onClick={() => setKey({ col: 'name' })} className="inline-flex items-center gap-1 hover:text-foreground">
                    {firstCol} {sortIcon({ col: 'name' })}
                  </button>
                </th>
                {METRICS.map((m) => (
                  <th key={m} colSpan={4} className="border-l border-border px-2.5 py-2 text-center text-[13px] font-bold text-foreground">
                    <button onClick={() => setKey({ col: m, sub: 'b' })} className="inline-flex items-center gap-1 hover:text-primary">
                      {METRIC_LABEL[m]}
                      {m === 'profit' && '*'}
                    </button>
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground">
                {METRICS.map((m) =>
                  (['a', 'b', 'd', 'pct'] as Sub[]).map((s) => (
                    <th key={m + s} className={cn('whitespace-nowrap px-2.5 py-1.5 text-right font-semibold', s === 'a' && 'border-l border-border/60')}>
                      <button
                        onClick={() => setKey({ col: m, sub: s })}
                        className={cn('ml-auto inline-flex max-w-[120px] items-center gap-1 hover:text-foreground', isActive({ col: m, sub: s }) && 'text-foreground')}
                        title={s === 'a' ? `A · ${labelA}` : s === 'b' ? `B · ${labelB}` : s === 'd' ? 'Selisih B − A' : 'Perubahan %'}
                      >
                        {sortIcon({ col: m, sub: s })}
                        <span className="truncate">{s === 'a' || s === 'b' ? `${s.toUpperCase()} · ${subLabel[s]}` : subLabel[s]}</span>
                      </button>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {body.length === 0 && (
                <tr>
                  <td colSpan={1 + METRICS.length * 4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Tidak ada data di kedua periode.
                  </td>
                </tr>
              )}
              {body.map((r, i) => (
                <tr key={`${r.brand}|${r.product}|${i}`} className="border-b border-border/70 last:border-0 hover:bg-muted/30">
                  <td className="sticky-col max-w-[260px] bg-card px-3 py-2 align-top">
                    <p className="flex items-center gap-1 truncate text-[13px] font-medium text-foreground" title={rowName(r)}>
                      <span className="truncate">{rowName(r)}</span>
                      <IncompleteIcon r={r} />
                    </p>
                    {level === 'product' && r.brand && <p className="text-[11px] text-muted-foreground">{r.brand}</p>}
                    <SideWarnings r={r} />
                  </td>
                  {cells(r)}
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/60">
                  <td className="sticky-col bg-muted px-3 py-2.5 text-[13px] font-bold text-foreground">
                    <span className="flex items-center gap-1">
                      Summary <IncompleteIcon r={summary} />
                    </span>
                    {summary.brand && <span className="block text-[11px] font-medium text-muted-foreground">{summary.brand}</span>}
                  </td>
                  {cells(summary, true)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* -------- HP: kartu accordion -------- */}
      <div className="space-y-2 md:hidden">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Urutkan
          <select
            className={cn(selectClass(), 'py-1.5 text-xs')}
            value={sort.key.col === 'name' ? 'name' : `${sort.key.col}:${sort.key.sub}:${sort.dir}`}
            onChange={(e) => {
              const [col, sub, dir] = e.target.value.split(':')
              if (col === 'name') setSort({ key: { col: 'name' }, dir: 'asc' })
              else setSort({ key: { col: col as Metric, sub: sub as Sub }, dir: dir as 'asc' | 'desc' })
            }}
          >
            <option value="name">{firstCol} (A–Z)</option>
            {METRICS.map((m) => (
              <optgroup key={m} label={METRIC_LABEL[m]}>
                <option value={`${m}:b:desc`}>{METRIC_LABEL[m]} B terbesar</option>
                <option value={`${m}:b:asc`}>{METRIC_LABEL[m]} B terkecil</option>
                <option value={`${m}:pct:desc`}>{METRIC_LABEL[m]} naik terbanyak (%)</option>
                <option value={`${m}:pct:asc`}>{METRIC_LABEL[m]} turun terbanyak (%)</option>
              </optgroup>
            ))}
          </select>
        </label>

        {body.length === 0 && (
          <p className="rounded-xl border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada data di kedua periode.</p>
        )}
        {[...body, ...(summary ? [summary] : [])].map((r, i) => {
          const isSum = r.row_type === 'summary'
          const id = isSum ? '__summary' : `${r.brand}|${r.product}|${i}`
          const expanded = open === id
          const t = trend('gmv', r.d.gmv)
          return (
            <div key={id} className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', isSum ? 'border-primary/40' : 'border-border')}>
              <button onClick={() => setOpen(expanded ? null : id)} className="flex w-full items-start gap-2 px-3.5 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <p className={cn('flex items-center gap-1 text-sm text-foreground', isSum ? 'font-bold' : 'font-medium')}>
                    <span className="truncate">{isSum ? 'Summary' : rowName(r)}</span>
                    <IncompleteIcon r={r} />
                  </p>
                  {(isSum || level === 'product') && r.brand && <p className="truncate text-[11px] text-muted-foreground">{r.brand}</p>}
                  {!isSum && <SideWarnings r={r} />}
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">GMV B</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{fmtValue('gmv', r.b.gmv)}</p>
                  <p className={cn('text-[11px] font-semibold tabular-nums', trendClass(t))}>{fmtPct(r.pct.gmv, r.a.gmv, r.b.gmv)}</p>
                </div>
                <ChevronDown className={cn('mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <div className="border-t border-border bg-muted/30 px-3.5 py-2">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1.5 text-xs">
                    <span />
                    <span className="max-w-[80px] truncate text-right font-semibold text-muted-foreground">A</span>
                    <span className="max-w-[80px] truncate text-right font-semibold text-muted-foreground">B</span>
                    <span className="text-right font-semibold text-muted-foreground">Δ%</span>
                    {METRICS.map((m) => {
                      const tm = trend(m, r.d[m])
                      return [
                        <span key={m + 'l'} className="text-muted-foreground">
                          {METRIC_LABEL[m]}
                        </span>,
                        <span key={m + 'a'} className="text-right tabular-nums text-muted-foreground">
                          {fmtValue(m, r.a[m])}
                        </span>,
                        <span key={m + 'b'} className="text-right font-semibold tabular-nums text-foreground">
                          {fmtValue(m, r.b[m])}
                        </span>,
                        <span key={m + 'p'} className={cn('text-right font-semibold tabular-nums', trendClass(tm))} title={fmtDelta(m, r.d[m])}>
                          {fmtPct(r.pct[m], r.a[m], r.b[m])}
                        </span>,
                      ]
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
