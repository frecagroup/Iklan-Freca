'use client'

// Data & RPC untuk Pengaturan HPP + Pajak Spend.
// Baca lewat view read-only di schema public; tulis lewat RPC di schema `ads` (hanya editor).
import { getSupabase } from './supabase/client'
import { BRANDS, type Brand } from './metrics'

export type HppRow = {
  brand: string
  section: string | null
  sku_id: string
  product_id: string | null
  product_name: string | null
  variant: string | null
  harga_jual: number | null
  hpp: number | null
  catatan: string | null
  berlaku_mulai: string | null
  version_id: number | null
  perubahan_terjadwal: string | null
}

export type HppVersion = {
  id: number
  hpp: number | null
  berlaku_mulai: string
  catatan: string | null
  source: string | null
  created_by: string | null
  created_at: string | null
}

export type Platform = 'tiktok' | 'shopee'
export type TaxCurrent = { platform: Platform; pct: number | null; berlaku_mulai: string | null }
export type TaxVersion = {
  id: number
  platform: Platform
  pct: number | null
  berlaku_mulai: string
  catatan: string | null
  created_by: string | null
  created_at: string | null
}

export type ImportRow = {
  brand: string
  section: string | null
  sku_id: string
  product_id: string | null
  product_name: string | null
  variant: string | null
  harga_jual: number | null
  hpp: number
  catatan: string | null
}

export type ImportResult = { dibuat: number; tidak_berubah: number; ditolak: number; pesan: string[] }

export const PLATFORM_LABEL: Record<Platform, string> = { tiktok: 'TikTok', shopee: 'Shopee PPN' }

/** Nama tab di Master HPP Freca → brand */
export const SECTION_BRAND: Record<string, Brand> = {
  Ghazal: 'Ghazal',
  'Sulkas Gaharu': 'Sultan Kasturi',
  'Sulkas Paket 3': 'Freca',
  Momea: 'Momea',
}

/** Section bawaan untuk brand (dipakai saat Tambah SKU / CSV tanpa kolom Section) */
export const BRAND_SECTION: Record<Brand, string> = {
  Ghazal: 'Ghazal',
  'Sultan Kasturi': 'Sulkas Gaharu',
  Freca: 'Sulkas Paket 3',
  Momea: 'Momea',
}

export function brandFromSection(section: string | null | undefined): Brand | null {
  if (!section) return null
  const s = section.trim().toLowerCase()
  for (const [k, v] of Object.entries(SECTION_BRAND)) if (k.toLowerCase() === s) return v
  const b = BRANDS.find((x) => x.toLowerCase() === s)
  return b ?? null
}

export function normalizeBrand(v: string | null | undefined): Brand | null {
  if (!v) return null
  const s = v.trim().toLowerCase()
  return BRANDS.find((b) => b.toLowerCase() === s) ?? brandFromSection(v)
}

const INACTIVE = /(DELETED|FREEZE|DEACTIVATED|DRAFT|FAILED)/i
export const isInactive = (catatan: string | null | undefined) => !!catatan && INACTIVE.test(catatan)

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

// ---------- baca ----------

export async function fetchIsEditor(): Promise<boolean> {
  const data = await unwrap(getSupabase().schema('ads').rpc('is_settings_editor'))
  return data === true
}

export async function fetchHppCurrent(): Promise<HppRow[]> {
  const sb = getSupabase()
  const out: HppRow[] = []
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const data = await unwrap(
      sb
        .from('ads_hpp_current')
        .select(
          'brand,section,sku_id,product_id,product_name,variant,harga_jual,hpp,catatan,berlaku_mulai,version_id,perubahan_terjadwal',
        )
        .order('brand')
        .order('product_name')
        .order('sku_id')
        .range(offset, offset + PAGE - 1),
    )
    const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as HppRow),
      sku_id: String(r.sku_id ?? ''),
      product_id: r.product_id == null ? null : String(r.product_id),
      harga_jual: num(r.harga_jual),
      hpp: num(r.hpp),
      version_id: num(r.version_id),
    }))
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

export async function fetchHppVersions(sku: string): Promise<HppVersion[]> {
  const data = await unwrap(
    getSupabase()
      .from('ads_hpp_versions')
      .select('id,hpp,berlaku_mulai,catatan,source,created_by,created_at')
      .eq('sku_id', sku)
      .order('berlaku_mulai', { ascending: false }),
  )
  return ((data ?? []) as HppVersion[]).map((r) => ({ ...r, id: Number(r.id), hpp: num(r.hpp) }))
}

export async function fetchTax(): Promise<{ current: TaxCurrent[]; versions: TaxVersion[] }> {
  const sb = getSupabase()
  const [current, versions] = await Promise.all([
    unwrap(sb.from('ads_tax_current').select('platform,pct,berlaku_mulai')),
    unwrap(
      sb
        .from('ads_tax_versions')
        .select('id,platform,pct,berlaku_mulai,catatan,created_by,created_at')
        .order('berlaku_mulai', { ascending: false }),
    ),
  ])
  return {
    current: ((current ?? []) as TaxCurrent[]).map((r) => ({ ...r, pct: num(r.pct) })),
    versions: ((versions ?? []) as TaxVersion[]).map((r) => ({ ...r, id: Number(r.id), pct: num(r.pct) })),
  }
}

// ---------- tulis (RPC editor) ----------

export type SetHppInput = {
  p_sku_id: string
  p_hpp: number
  p_berlaku_mulai: string | null
  p_catatan: string | null
  p_brand?: string | null
  p_section?: string | null
  p_product_id?: string | null
  p_product_name?: string | null
  p_variant?: string | null
  p_harga_jual?: number | null
}

export async function setHpp(input: SetHppInput) {
  return unwrap(getSupabase().schema('ads').rpc('set_hpp', input))
}

export async function importHpp(rows: ImportRow[], berlakuMulai: string | null): Promise<ImportResult> {
  const data = await unwrap(
    getSupabase().schema('ads').rpc('import_hpp', { p_rows: rows, p_berlaku_mulai: berlakuMulai }),
  )
  const r = (Array.isArray(data) ? data[0] : data) as Partial<ImportResult> | null
  return {
    dibuat: Number(r?.dibuat ?? 0),
    tidak_berubah: Number(r?.tidak_berubah ?? 0),
    ditolak: Number(r?.ditolak ?? 0),
    pesan: Array.isArray(r?.pesan) ? r!.pesan!.map(String) : [],
  }
}

export async function setTax(platform: Platform, pct: number, berlakuMulai: string | null, catatan: string | null) {
  return unwrap(
    getSupabase()
      .schema('ads')
      .rpc('set_tax', { p_platform: platform, p_pct: pct, p_berlaku_mulai: berlakuMulai, p_catatan: catatan }),
  )
}

export async function deleteFutureVersion(kind: 'hpp' | 'tax', id: number): Promise<boolean> {
  const data = await unwrap(getSupabase().schema('ads').rpc('delete_future_version', { p_kind: kind, p_id: id }))
  return data === true
}
