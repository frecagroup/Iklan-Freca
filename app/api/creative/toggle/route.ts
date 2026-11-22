import { NextResponse, type NextRequest } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * POST /api/creative/toggle — On/Off creative di kampanye Product GMV Max yang sedang ENABLE.
 *
 * Alur: sesi user (anon key + cookie) → ads.is_creative_editor() → validasi body →
 * kampanye aktif dari view ads_gmv_max_campaign_current → TikTok (HANYA di server) →
 * ads.record_creative_action (log + preferensi On/Off, juga saat gagal).
 *
 * Token TikTok (TIKTOK_ACCESS_TOKEN) hanya dibaca di sini: tidak pernah dikirim ke klien,
 * tidak di-log, bukan NEXT_PUBLIC_*. Tidak ada service role key.
 */

export const dynamic = 'force-dynamic'

const TIKTOK_URL = 'https://business-api.tiktok.com/open_api/v1.3/campaign/gmv_max/creative/update/'
const TIKTOK_TIMEOUT_MS = 20_000
const ID_RE = /^\d{1,32}$/

type Action = 'ADD' | 'REMOVE'
type Body = { brand: string; product: string; item_group_id: string; item_id: string; action: Action }
type Campaign = { advertiser_id: string; campaign_id: string; campaign_name: string | null }
type TikTokResult = { code: number | null; message: string; request_id: string | null }

function reply(status: number, ok: boolean, resultStatus: string, message: string) {
  return NextResponse.json({ ok, status: resultStatus, message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function parseBody(raw: unknown): Body | string {
  if (!raw || typeof raw !== 'object') return 'Body harus JSON'
  const b = raw as Record<string, unknown>
  const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : typeof b[k] === 'number' ? String(b[k]) : '')
  const body: Body = {
    brand: s('brand'),
    product: s('product'),
    item_group_id: s('item_group_id'),
    item_id: s('item_id'),
    action: s('action').toUpperCase() as Action,
  }
  if (!body.brand) return 'brand wajib diisi'
  if (!body.product) return 'product wajib diisi'
  if (body.action !== 'ADD' && body.action !== 'REMOVE') return "action harus 'ADD' atau 'REMOVE'"
  if (!body.item_id || body.item_id === '-1') return 'Kartu produk tidak bisa di-on/off'
  if (!ID_RE.test(body.item_id)) return 'item_id tidak valid'
  if (!ID_RE.test(body.item_group_id)) return 'item_group_id tidak valid'
  return body
}

/** Origin lain (bukan web ini) ditolak — lapisan tambahan di atas cookie SameSite */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.get('host')
  } catch {
    return false
  }
}

async function callTikTok(campaign: Campaign, body: Body): Promise<TikTokResult> {
  const token = process.env.TIKTOK_ACCESS_TOKEN
  if (!token) return { code: null, message: 'TIKTOK_ACCESS_TOKEN belum diisi di server (Vercel env).', request_id: null }
  try {
    const res = await fetch(TIKTOK_URL, {
      method: 'POST',
      headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advertiser_id: campaign.advertiser_id,
        campaign_id: campaign.campaign_id,
        action: body.action,
        item_list: [{ item_id: body.item_id, spu_id_list: [body.item_group_id] }],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIKTOK_TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => null)) as { code?: unknown; message?: unknown; request_id?: unknown } | null
    if (!json) return { code: null, message: `TikTok merespons HTTP ${res.status} tanpa JSON`, request_id: null }
    const code = typeof json.code === 'number' ? json.code : Number(json.code)
    return {
      code: Number.isFinite(code) ? code : null,
      message: String(json.message ?? (res.ok ? 'OK' : `HTTP ${res.status}`)),
      request_id: json.request_id ? String(json.request_id) : null,
    }
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    return { code: null, message: timeout ? 'TikTok tidak merespons (timeout)' : 'Gagal menghubungi TikTok', request_id: null }
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply(403, false, 'forbidden', 'Origin tidak diizinkan')

  let supabase: Awaited<ReturnType<typeof getServerSupabase>>
  try {
    supabase = await getServerSupabase()
  } catch (e) {
    return reply(500, false, 'config', e instanceof Error ? e.message : 'Konfigurasi server belum lengkap')
  }

  // 1. sesi
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return reply(401, false, 'unauthorized', 'Sesi login habis, silakan login ulang.')

  // 2. hak toggle (dicek di database)
  const editor = await supabase.schema('ads').rpc('is_creative_editor')
  if (editor.error) return reply(500, false, 'error', editor.error.message)
  if (editor.data !== true) return reply(403, false, 'forbidden', 'Tidak punya akses on/off creative')

  // 3. body
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return reply(400, false, 'bad_request', 'Body harus JSON')
  }
  const body = parseBody(raw)
  if (typeof body === 'string') return reply(400, false, 'bad_request', body)

  // kartu produk tidak boleh ditoggle (cek juga di data, bukan hanya item_id -1)
  const card = await supabase
    .from('ads_gmv_max_creative_daily')
    .select('item_id')
    .eq('item_id', body.item_id)
    .eq('shop_content_type', 'PRODUCT_CARD')
    .limit(1)
  if (!card.error && (card.data?.length ?? 0) > 0) return reply(400, false, 'bad_request', 'Kartu produk tidak bisa di-on/off')

  // 4. kampanye Product GMV Max yang sedang ENABLE untuk produk ini
  const camp = await supabase
    .from('ads_gmv_max_campaign_current')
    .select('advertiser_id,campaign_id,campaign_name,operation_status,product_video_specific_type,updated_at')
    .eq('brand', body.brand)
    .eq('item_group_id', body.item_group_id)
    .eq('operation_status', 'ENABLE')
    .eq('product_video_specific_type', 'AUTO_SELECTION')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (camp.error) return reply(500, false, 'error', camp.error.message)
  const c = camp.data?.[0] as Record<string, unknown> | undefined
  if (!c?.advertiser_id || !c?.campaign_id) {
    return reply(409, false, 'no_campaign', 'Tidak ada kampanye GMV Max aktif (ENABLE, pemilihan video otomatis) untuk produk ini.')
  }
  const campaign: Campaign = {
    advertiser_id: String(c.advertiser_id),
    campaign_id: String(c.campaign_id),
    campaign_name: c.campaign_name ? String(c.campaign_name) : null,
  }

  // 5. TikTok (server only)
  const tt = await callTikTok(campaign, body)
  const ok = tt.code === 0
  const resultStatus = ok ? 'ok' : 'error'

  // 6. catat ke database — tetap dipanggil walau TikTok gagal, supaya ada jejak
  const rec = await supabase.schema('ads').rpc('record_creative_action', {
    p_brand: body.brand,
    p_product: body.product,
    p_item_group_id: body.item_group_id,
    p_item_id: body.item_id,
    p_action: body.action,
    p_advertiser_id: campaign.advertiser_id,
    p_campaign_id: campaign.campaign_id,
    p_result_status: resultStatus,
    p_tiktok_code: tt.code == null ? null : String(tt.code), // kolom text di DB
    p_tiktok_message: tt.message,
    p_request_id: tt.request_id,
    p_source: 'web',
  })
  if (rec.error) {
    // jangan log token/header; cukup pesan RPC
    console.error('[creative/toggle] record_creative_action gagal:', rec.error.message)
  }

  if (!ok) return reply(502, false, 'error', tt.message || 'TikTok menolak perubahan')

  const done = body.action === 'REMOVE' ? 'Video dikeluarkan dari kampanye' : 'Video dimasukkan lagi ke kampanye'
  const warn = rec.error ? ` (catatan: log gagal disimpan — ${rec.error.message})` : ''
  return reply(200, true, 'ok', `${done}${campaign.campaign_name ? ` "${campaign.campaign_name}"` : ''}.${warn}`)
}
