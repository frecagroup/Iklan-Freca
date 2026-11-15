// Agregasi metrik iklan. Rasio SELALU dihitung ulang dari total (bukan rata-rata kolom rasio),
// supaya angka periode multi-hari & summary brand konsisten.

export const BRANDS = ['Ghazal', 'Sultan Kasturi', 'Freca', 'Momea'] as const
export type Brand = (typeof BRANDS)[number]

export function brandSlug(b: string): string {
  return b.toLowerCase().replace(/\s+/g, '-')
}
export function brandFromSlug(slug: string): Brand | null {
  return BRANDS.find((b) => brandSlug(b) === slug) ?? null
}

export type AdsRow = {
  date: string
  brand: string
  product: string
  orders: number | null
  gmv: number | null
  spend: number | null
  cpr: number | null
  roas: number | null
  profit: number | null
  poas: number | null
  npm: number | null
  margin_per_order: number | null
  fee_pct: number | null
  cancel_pct: number | null
  rts_pct: number | null
  updated_at: string | null
}

export type Totals = {
  orders: number
  gmv: number
  spend: number
  profit: number
  /** GMV / Spend */
  roas: number | null
  /** Profit / Spend */
  poas: number | null
  /** Profit / GMV × 100 */
  npm: number | null
  /** Spend / Order */
  cpr: number | null
}

const n = (v: number | null | undefined) => {
  const x = Number(v ?? 0)
  return Number.isFinite(x) ? x : 0
}

export function sumRows(rows: AdsRow[]): Totals {
  let orders = 0
  let gmv = 0
  let spend = 0
  let profit = 0
  for (const r of rows) {
    orders += n(r.orders)
    gmv += n(r.gmv)
    spend += n(r.spend)
    profit += n(r.profit)
  }
  return {
    orders,
    gmv,
    spend,
    profit,
    roas: spend > 0 ? gmv / spend : null,
    poas: spend > 0 ? profit / spend : null,
    npm: gmv > 0 ? (profit / gmv) * 100 : null,
    cpr: orders > 0 ? spend / orders : null,
  }
}

export const NPM_THRESHOLD = 10

/** Peringatan: NPM < 10% atau profit negatif */
export function isWarning(t: Totals): boolean {
  if (t.profit < 0) return true
  if (t.npm !== null && t.npm < NPM_THRESHOLD) return true
  return false
}

export function warningReason(t: Totals): string | null {
  if (t.profit < 0) return 'Rugi'
  if (t.npm !== null && t.npm < NPM_THRESHOLD) return 'NPM < 10%'
  return null
}

export type ProductTotals = Totals & { product: string; brand: string }

export function groupByProduct(rows: AdsRow[]): ProductTotals[] {
  const map = new Map<string, AdsRow[]>()
  for (const r of rows) {
    const k = `${r.brand}\u0000${r.product}`
    const arr = map.get(k)
    if (arr) arr.push(r)
    else map.set(k, [r])
  }
  return [...map.entries()].map(([k, rs]) => {
    const [brand, product] = k.split('\u0000')
    return { brand, product, ...sumRows(rs) }
  })
}

export function filterBrand(rows: AdsRow[], brand: string | null): AdsRow[] {
  return brand ? rows.filter((r) => r.brand === brand) : rows
}
