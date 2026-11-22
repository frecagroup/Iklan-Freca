'use client'

// Creative / video GMV Max per produk.
// Baca: view public + RPC schema `ads`. Toggle on/off TIDAK lewat RPC dari klien,
// tapi lewat API route server POST /api/creative/toggle (token TikTok hanya di server).
import { getSupabase } from './supabase/client'

export type CreativeFilter = 'berbiaya' | 'aktif' | 'excluded' | 'semua'
export type CreativeSort = 'spend' | 'orders' | 'gmv' | 'cpr' | 'roas' | 'title'
export type SortDir = 'asc' | 'desc'

export const CREATIVE_FILTERS: Array<[CreativeFilter, string]> = [
  ['berbiaya', 'Berbiaya'],
  ['aktif', 'Aktif'],
  ['excluded', 'Dimatikan'],
  ['semua', 'Semua'],
]
export const PAGE_SIZES = [5, 10, 20] as const

export type CreativeRow = {
  item_id: string
  item_group_id: string | null
  title: string | null
  tt_account_name: string | null
  shop_content_type: string | null
  creative_delivery_status: string | null
  orders: number
  gmv: number
  spend: number
  cpr: number | null
  roas: number | null
  last_updated_at: string | null
  target_cpr: number | null
  cpr_over_target: boolean
  toggle_allowed: boolean
  current_campaign_id: string | null
  desired_state: 'ON' | 'OFF' | null
  total_count: number
}

export type CreativePageArgs = {
  from: string
  to: string
  brand: string
  product: string
  page: number
  pageSize: number
  sort: CreativeSort
  dir: SortDir
  filter: CreativeFilter
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))

/** Kartu produk (bukan video): tidak bisa di-on/off, tidak ada tautan TikTok */
export function isProductCard(r: Pick<CreativeRow, 'item_id' | 'shop_content_type'>): boolean {
  return r.item_id === '-1' || (r.shop_content_type ?? '').toUpperCase() === 'PRODUCT_CARD'
}

const normStatus = (s: string | null | undefined) =>
  (s ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

/** Status pengiriman TikTok → label Indonesia singkat + nada warna */
export function statusLabel(r: Pick<CreativeRow, 'item_id' | 'shop_content_type' | 'creative_delivery_status'>): {
  label: string
  tone: 'success' | 'warning' | 'destructive' | 'neutral' | 'primary'
} {
  if (isProductCard(r)) return { label: 'Kartu produk', tone: 'primary' }
  const s = normStatus(r.creative_delivery_status)
  switch (s) {
    case 'DELIVERING':
      return { label: 'Berjalan', tone: 'success' }
    case 'LEARNING':
      return { label: 'Uji', tone: 'warning' }
    case 'EXCLUDED':
      return { label: 'Mati', tone: 'destructive' }
    case 'IN_QUEUE':
    case 'QUEUING':
      return { label: 'Antrian', tone: 'neutral' }
    case 'NOT_DELIVERING':
    case 'NOT_DELIVERY':
    case 'NOT_DELIVERYING': // ejaan resmi TikTok API
      return { label: 'Tidak jalan', tone: 'neutral' }
    case 'AUTHORIZATION_NEEDED':
    case 'UNAUTHORIZED':
      return { label: 'Butuh izin', tone: 'warning' }
    case 'UNAVAILABLE':
      return { label: 'Tidak tersedia', tone: 'neutral' }
    case 'REJECTED':
      return { label: 'Ditolak', tone: 'destructive' }
    case 'PAUSED':
      return { label: 'Jeda', tone: 'neutral' }
    case '':
      return { label: '—', tone: 'neutral' }
    default:
      return { label: r.creative_delivery_status ?? '—', tone: 'neutral' }
  }
}

export const isExcluded = (r: Pick<CreativeRow, 'creative_delivery_status'>) => normStatus(r.creative_delivery_status) === 'EXCLUDED'
export const isLearning = (r: Pick<CreativeRow, 'creative_delivery_status'>) => normStatus(r.creative_delivery_status) === 'LEARNING'

/** Posisi toggle: desired_state bila ada; selain itu EXCLUDED = Off, status lain = On */
export function toggleIsOn(r: CreativeRow): boolean {
  if (r.desired_state === 'OFF') return false
  if (r.desired_state === 'ON') return true
  return !isExcluded(r)
}

/** Preferensi sudah dikirim tapi laporan TikTok/sync belum menyusul */
export function waitingSync(r: CreativeRow): boolean {
  if (!r.desired_state || isProductCard(r)) return false
  return r.desired_state === 'OFF' ? !isExcluded(r) : isExcluded(r)
}

// ---------- baca ----------

export async function fetchIsCreativeEditor(): Promise<boolean> {
  const { data, error } = await getSupabase().schema('ads').rpc('is_creative_editor')
  if (error) throw error
  return data === true
}

export async function fetchCreativePage(a: CreativePageArgs): Promise<{ rows: CreativeRow[]; total: number }> {
  const { data, error } = await getSupabase()
    .schema('ads')
    .rpc('creative_period_summary', {
      p_from: a.from,
      p_to: a.to,
      p_brand: a.brand,
      p_product: a.product,
      p_page: a.page,
      p_page_size: a.pageSize,
      p_sort: a.sort,
      p_dir: a.dir,
      p_filter: a.filter,
    })
  if (error) throw error
  const rows = ((data ?? []) as Record<string, unknown>[]).map(
    (r): CreativeRow => ({
      item_id: String(r.item_id ?? ''),
      item_group_id: str(r.item_group_id),
      title: str(r.title),
      tt_account_name: str(r.tt_account_name),
      shop_content_type: str(r.shop_content_type),
      creative_delivery_status: str(r.creative_delivery_status),
      orders: num(r.orders) ?? 0,
      gmv: num(r.gmv) ?? 0,
      spend: num(r.spend) ?? 0,
      cpr: num(r.cpr),
      roas: num(r.roas),
      last_updated_at: str(r.last_updated_at),
      target_cpr: num(r.target_cpr),
      cpr_over_target: r.cpr_over_target === true,
      toggle_allowed: r.toggle_allowed === true,
      current_campaign_id: str(r.current_campaign_id),
      desired_state: r.desired_state === 'ON' || r.desired_state === 'OFF' ? r.desired_state : null,
      total_count: num(r.total_count) ?? 0,
    }),
  )
  return { rows, total: rows[0]?.total_count ?? 0 }
}

export async function fetchCreativeUpdatedAt(from: string, to: string, brand: string, product: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .schema('ads')
    .rpc('creative_product_updated_at', { p_from: from, p_to: to, p_brand: brand, p_product: product })
  if (error) throw error
  return str(Array.isArray(data) ? data[0] : data)
}

/** Target CPR semua produk satu brand → map product → target */
export async function fetchCprTargets(brand: string): Promise<Record<string, number | null>> {
  const { data, error } = await getSupabase().from('ads_cpr_target').select('product,target_cpr').eq('brand', brand)
  if (error) throw error
  const out: Record<string, number | null> = {}
  for (const r of (data ?? []) as Array<{ product: string; target_cpr: unknown }>) out[r.product] = num(r.target_cpr)
  return out
}

// ---------- tulis ----------

/** target wajib > 0 (database menolak null / ≤ 0) */
export async function setCprTarget(brand: string, product: string, target: number) {
  if (!(target > 0)) throw new Error('Target CPR harus angka lebih dari 0')
  const { data, error } = await getSupabase()
    .schema('ads')
    .rpc('set_cpr_target', { p_brand: brand, p_product: product, p_target_cpr: target })
  if (error) throw error
  return data
}

export type ToggleAction = 'ADD' | 'REMOVE'
export type ToggleResult = { ok: boolean; status: string; message: string }

/** On/Off lewat API route server (yang memegang token TikTok). */
export async function toggleCreative(body: {
  brand: string
  product: string
  item_group_id: string
  item_id: string
  action: ToggleAction
}): Promise<ToggleResult> {
  let res: Response
  try {
    res = await fetch('/api/creative/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new Error('Tidak bisa menghubungi server. Cek koneksi lalu coba lagi.')
  }
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    // proxy mengalihkan ke /login bila sesi habis
    throw new Error(res.redirected ? 'Sesi login habis, silakan login ulang.' : `Server error (${res.status})`)
  }
  const json = (await res.json()) as Partial<ToggleResult>
  const out: ToggleResult = { ok: json.ok === true, status: String(json.status ?? res.status), message: String(json.message ?? '') }
  if (!res.ok || !out.ok) throw new Error(out.message || `Gagal (${res.status})`)
  return out
}
