'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'
import { WarnBadge } from './metrics-view'
import { decimal, integer, percent, rupiah } from '@/lib/format'
import { isWarning, NPM_THRESHOLD, warningReason, type ProductTotals, type Totals } from '@/lib/metrics'
import { cn } from '@/lib/cn'

type Key = 'product' | 'gmv' | 'orders' | 'spend' | 'cpr' | 'roas' | 'profit' | 'poas' | 'npm'

const COLS: Array<{ key: Key; label: string; num: boolean }> = [
  { key: 'product', label: 'Produk', num: false },
  { key: 'gmv', label: 'GMV', num: true },
  { key: 'orders', label: 'Pesanan', num: true },
  { key: 'spend', label: 'Spend Iklan', num: true },
  { key: 'cpr', label: 'CPR', num: true },
  { key: 'roas', label: 'ROAS', num: true },
  { key: 'profit', label: 'Profit*', num: true },
  { key: 'poas', label: 'POAS', num: true },
  { key: 'npm', label: 'NPM', num: true },
]

function cell(key: Exclude<Key, 'product'>, t: Totals): string {
  switch (key) {
    case 'gmv':
      return rupiah(t.gmv)
    case 'orders':
      return integer(t.orders)
    case 'spend':
      return rupiah(t.spend)
    case 'cpr':
      return rupiah(t.cpr)
    case 'roas':
      return decimal(t.roas)
    case 'profit':
      return rupiah(t.profit)
    case 'poas':
      return decimal(t.poas)
    case 'npm':
      return percent(t.npm)
  }
}

/** ⚠ profit belum lengkap (ada baris tanpa HPP) */
function Incomplete({ n }: { n?: number }) {
  if (!n || n <= 0) return null
  return (
    <span title={`Profit belum lengkap: ${n} baris tanpa HPP`} className="mr-1 inline-flex align-[-2px] text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
    </span>
  )
}

function tone(key: Key, t: Totals): string {
  if (key === 'profit' && t.profit < 0) return 'text-destructive'
  if (key === 'poas' && t.poas !== null && t.poas < 0) return 'text-destructive'
  if (key === 'npm' && (t.profit < 0 || (t.npm !== null && t.npm < NPM_THRESHOLD))) return 'text-destructive'
  return ''
}

type Item = ProductTotals & { profitIncomplete?: number }

export function ProductTable({
  items,
  summary,
  renderDetail,
}: {
  items: Item[]
  summary: Totals & { profitIncomplete?: number }
  /** bila diisi: baris produk bisa dibuka/tutup (beberapa sekaligus) untuk menampilkan detail */
  renderDetail?: (p: Item) => ReactNode
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggleOpen = (k: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  // lebar area tabel yang terlihat → panel detail menempel di kiri & selebar layar walau tabel di-scroll ke samping
  const scrollRef = useRef<HTMLDivElement>(null)
  const expandable = !!renderDetail
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !expandable) return
    const set = () => el.style.setProperty('--pt-visible-w', `${el.clientWidth}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [expandable])

  const [sort, setSort] = useState<{ key: Key; dir: 'asc' | 'desc' }>({ key: 'gmv', dir: 'desc' })

  const sorted = useMemo(() => {
    const arr = [...items]
    const { key, dir } = sort
    const m = dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (key === 'product') return a.product.localeCompare(b.product, 'id') * m
      const va = a[key]
      const vb = b[key]
      if (va === null && vb === null) return 0
      if (va === null) return 1 // kosong selalu di bawah
      if (vb === null) return -1
      return (va - vb) * m
    })
    return arr
  }, [items, sort])

  const toggle = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'product' ? 'asc' : 'desc' }))

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              {COLS.map((c) => {
                const active = sort.key === c.key
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={c.key}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn(
                      'whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-muted-foreground',
                      c.num ? 'text-right' : 'sticky-col bg-muted text-left',
                    )}
                  >
                    <button
                      onClick={() => toggle(c.key)}
                      className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground', c.num && 'flex-row-reverse')}
                    >
                      {c.label}
                      <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-40')} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-10 text-center text-muted-foreground">
                  Belum ada data di periode ini.
                </td>
              </tr>
            )}
            {sorted.map((p) => {
              const warn = p.spend + p.gmv > 0 && isWarning(p)
              const k = `${p.brand}|${p.product}`
              const isOpen = !!renderDetail && open.has(k)
              return (
                <Fragment key={k}>
                <tr
                  className={cn(
                    'border-b border-border/70 last:border-0',
                    warn && 'bg-destructive/5',
                    renderDetail && 'cursor-pointer hover:bg-muted/40',
                    isOpen && 'border-b-0',
                  )}
                  onClick={renderDetail ? () => toggleOpen(k) : undefined}
                  aria-expanded={renderDetail ? isOpen : undefined}
                >
                  <td
                    className="sticky-col max-w-[180px] bg-card px-3 py-2.5 align-top sm:max-w-[260px]"
                    style={warn ? { background: 'color-mix(in srgb, var(--color-destructive) 5%, var(--color-card))' } : undefined}
                  >
                    <p className="flex items-center gap-1.5 font-medium text-foreground" title={p.product}>
                      {renderDetail && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleOpen(k)
                          }}
                          aria-label={isOpen ? 'Tutup detail video' : 'Buka detail video'}
                          className="-ml-1 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90 text-primary')} />
                        </button>
                      )}
                      <span className="truncate">{p.product}</span>
                    </p>
                    {warn && (
                      <div className="mt-0.5">
                        <WarnBadge size="sm">{warningReason(p)}</WarnBadge>
                      </div>
                    )}
                  </td>
                  {COLS.slice(1).map((c) => (
                    <td key={c.key} className={cn('whitespace-nowrap px-3 py-2.5 text-right tabular-nums', tone(c.key, p))}>
                      {c.key === 'profit' && <Incomplete n={p.profitIncomplete} />}
                      {cell(c.key as Exclude<Key, 'product'>, p)}
                    </td>
                  ))}
                </tr>
                {isOpen && (
                  <tr className="border-b border-border/70">
                    <td colSpan={COLS.length} className="bg-muted/30 p-0">
                      {/* menempel di kiri, selebar area yang terlihat (tidak ikut tergeser saat tabel produk di-scroll) */}
                      <div className="sticky left-0 max-w-full p-2.5 sm:p-3" style={{ width: 'var(--pt-visible-w, 100%)' }}>
                        {renderDetail(p)}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/60 font-bold">
                <td className="sticky-col bg-muted px-3 py-3 text-foreground">
                  Summary
                </td>
                {COLS.slice(1).map((c) => (
                  <td key={c.key} className={cn('whitespace-nowrap px-3 py-3 text-right tabular-nums text-foreground', tone(c.key, summary))}>
                    {c.key === 'profit' && <Incomplete n={summary.profitIncomplete} />}
                    {cell(c.key as Exclude<Key, 'product'>, summary)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
