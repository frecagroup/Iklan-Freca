'use client'

// Komparasi: RPC ads.compare & ads.period_summary
import { getSupabase } from './supabase/client'
import { decimal, integer, rupiah } from './format'
import type { ProductTotals, Totals } from './metrics'

export const METRICS = ['gmv', 'orders', 'spend', 'cpr', 'roas', 'profit', 'poas', 'npm'] as const
export type Metric = (typeof METRICS)[number]

export const METRIC_LABEL: Record<Metric, string> = {
  gmv: 'GMV',
  orders: 'Pesanan',
  spend: 'Spend Iklan',
  cpr: 'CPR',
  roas: 'ROAS',
  profit: 'Profit',
  poas: 'POAS',
  npm: 'NPM',
}

/** Spend & CPR naik = lebih boros (buruk); metrik lain naik = membaik */
export const LOWER_IS_BETTER: Record<Metric, boolean> = {
  gmv: false,
  orders: false,
  spend: true,
  cpr: true,
  roas: false,
  profit: false,
  poas: false,
  npm: false,
}

export type Side = Record<Metric, number | null>

export type CompareRow = {
  row_type: 'product' | 'brand' | 'summary'
  brand: string | null
  product: string | null
  a: Side
  b: Side
  d: Side
  pct: Side
  a_profit_incomplete: number
  b_profit_incomplete: number
  a_has_running: boolean
  b_has_running: boolean
}

export type CompareArgs = {
  a_brand: string | null
  a_from: string
  a_to: string
  b_brand: string | null
  b_from: string
  b_to: string
  p_level: 'product' | 'brand'
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function side(r: Record<string, unknown>, prefix: string): Side {
  const out = {} as Side
  for (const m of METRICS) out[m] = n(r[`${prefix}_${m}`])
  return out
}

export async function fetchCompare(args: CompareArgs): Promise<CompareRow[]> {
  const { data, error } = await getSupabase().schema('ads').rpc('compare', args)
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    row_type: (r.row_type as CompareRow['row_type']) ?? 'product',
    brand: (r.brand as string | null) ?? null,
    product: (r.product as string | null) ?? null,
    a: side(r, 'a'),
    b: side(r, 'b'),
    d: side(r, 'd'),
    pct: side(r, 'pct'),
    a_profit_incomplete: n(r.a_profit_incomplete) ?? 0,
    b_profit_incomplete: n(r.b_profit_incomplete) ?? 0,
    a_has_running: r.a_has_running === true,
    b_has_running: r.b_has_running === true,
  }))
}

export type SummaryRow = Totals & {
  row_type: 'product' | 'brand_summary' | 'grand_summary'
  brand: string
  product: string | null
  days: number | null
  profit_incomplete: number
  has_running: boolean
}

export async function fetchPeriodSummary(from: string, to: string, brands: string[] | null): Promise<SummaryRow[]> {
  const { data, error } = await getSupabase()
    .schema('ads')
    .rpc('period_summary', { p_from: from, p_to: to, p_brands: brands && brands.length ? brands : null })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    row_type: r.row_type as SummaryRow['row_type'],
    brand: String(r.brand ?? ''),
    product: (r.product as string | null) ?? null,
    orders: n(r.orders) ?? 0,
    gmv: n(r.gmv) ?? 0,
    spend: n(r.spend) ?? 0,
    profit: n(r.profit) ?? 0,
    cpr: n(r.cpr),
    roas: n(r.roas),
    poas: n(r.poas),
    npm: n(r.npm),
    days: n(r.days),
    profit_incomplete: n(r.profit_incomplete) ?? 0,
    has_running: r.has_running === true,
  }))
}

/** Pisahkan hasil period_summary jadi baris produk + summary untuk ProductTable */
export function splitSummary(rows: SummaryRow[]): { items: Array<ProductTotals & { profitIncomplete?: number }>; summary: SummaryRow | null } {
  const items = rows
    .filter((r) => r.row_type === 'product')
    .map((r) => ({ ...r, product: r.product ?? '—', profitIncomplete: r.profit_incomplete }))
  const summary = rows.find((r) => r.row_type === 'grand_summary') ?? rows.find((r) => r.row_type === 'brand_summary') ?? null
  return { items, summary }
}

// ---------- format ----------

export function fmtValue(m: Metric, v: number | null): string {
  if (v === null) return '–'
  switch (m) {
    case 'gmv':
    case 'spend':
    case 'cpr':
    case 'profit':
      return rupiah(v)
    case 'orders':
      return integer(v)
    case 'roas':
    case 'poas':
      return decimal(v)
    case 'npm':
      return `${decimal(v, 1)}%`
  }
}

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '')

export function fmtDelta(m: Metric, v: number | null): string {
  if (v === null) return '–'
  const a = Math.abs(v)
  switch (m) {
    case 'gmv':
    case 'spend':
    case 'cpr':
    case 'profit':
      return `${sign(v)}${rupiah(a)}`
    case 'orders':
      return `${sign(v)}${integer(a)}`
    case 'roas':
    case 'poas':
      return `${sign(v)}${decimal(a)}`
    case 'npm':
      return `${sign(v)}${decimal(a, 1)} poin`
  }
}

/** Teks perubahan %: "▲ 11,16%", "baru" (A = 0, B ≠ 0), "–" */
export function fmtPct(pct: number | null, a: number | null, b: number | null): string {
  if (pct === null) return (a === null || a === 0) && b !== null && b !== 0 ? 'baru' : '–'
  if (pct === 0) return '0%'
  return `${pct > 0 ? '▲' : '▼'} ${decimal(Math.abs(pct), 2)}%`
}

/** 1 = membaik, -1 = memburuk, 0 = netral */
export function trend(m: Metric, delta: number | null): -1 | 0 | 1 {
  if (delta === null || delta === 0) return 0
  const up = delta > 0
  return (LOWER_IS_BETTER[m] ? !up : up) ? 1 : -1
}

export const trendClass = (t: -1 | 0 | 1) => (t > 0 ? 'text-success' : t < 0 ? 'text-destructive' : 'text-muted-foreground')

/** Totals dari satu sisi (untuk aturan badge NPM < 10% / rugi) */
export function sideTotals(s: Side): Totals {
  return {
    orders: s.orders ?? 0,
    gmv: s.gmv ?? 0,
    spend: s.spend ?? 0,
    profit: s.profit ?? 0,
    roas: s.roas,
    poas: s.poas,
    npm: s.npm,
    cpr: s.cpr,
  }
}
