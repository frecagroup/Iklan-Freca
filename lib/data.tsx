'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { getSupabase } from './supabase/client'
import { addDays, todayWIB } from './format'
import { fetchIsEditor } from './settings'
import type { AdsRow } from './metrics'

// ---------------- Periode ----------------

export type Preset = 'today' | 'yesterday' | '7' | '30' | 'custom'
export type Range = { from: string; to: string }

export const PRESETS: Array<[Exclude<Preset, 'custom'>, string]> = [
  ['today', 'Hari ini'],
  ['yesterday', 'Kemarin'],
  ['7', '7 Hari'],
  ['30', '30 Hari'],
]

export function rangeOf(preset: Preset, custom: Range, today: string = todayWIB()): Range {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { from: y, to: y }
    }
    case '7':
      return { from: addDays(today, -6), to: today }
    case '30':
      return { from: addDays(today, -29), to: today }
    default:
      return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  }
}

export const REFRESH_MS = 5 * 60 * 1000

export type SyncStatus = { last_run: string | null; status: string | null; note: string | null }

// Pilihan periode disimpan per tab (sessionStorage) lewat store kecil supaya aman untuk hydration
type PeriodState = { preset: Preset; custom: Range }
const STORE_KEY = 'freca-ads-period'

function defaultPeriod(): PeriodState {
  const t = todayWIB()
  return { preset: 'today', custom: { from: addDays(t, -6), to: t } }
}

const serverPeriod = defaultPeriod()
let periodState: PeriodState | null = null
const periodListeners = new Set<() => void>()

function readPeriod(): PeriodState {
  if (periodState) return periodState
  let next = defaultPeriod()
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<PeriodState>
      next = {
        preset: v.preset ?? next.preset,
        custom: v.custom?.from && v.custom?.to ? v.custom : next.custom,
      }
    }
  } catch {
    /* abaikan */
  }
  periodState = next
  return next
}

function writePeriod(next: PeriodState) {
  periodState = next
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    /* abaikan */
  }
  periodListeners.forEach((l) => l())
}

function subscribePeriod(l: () => void) {
  periodListeners.add(l)
  return () => {
    periodListeners.delete(l)
  }
}

type Ctx = {
  preset: Preset
  custom: Range
  range: Range
  /** tanggal hari ini (WIB), ikut bergeser saat refresh setelah tengah malam */
  today: string
  setPreset: (p: Preset) => void
  setCustom: (r: Range) => void
  /** naik setiap auto-refresh / tombol refresh → memicu fetch ulang */
  tick: number
  refresh: () => void
  refreshing: boolean
  /** daftarkan request supaya ikon refresh berputar sampai semua selesai */
  track: <T>(p: Promise<T>) => Promise<T>
  sync: SyncStatus | null
  lastFetched: Date | null
  /** boleh membuka Pengaturan (ads.is_settings_editor). null = belum diketahui */
  isEditor: boolean | null
  /** pesan error terakhir saat cek status editor (dianggap bukan editor) */
  editorError: string | null
}

const DashCtx = createContext<Ctx | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const period = useSyncExternalStore(subscribePeriod, readPeriod, () => serverPeriod)
  const [tick, setTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [today, setToday] = useState(todayWIB)
  const pending = useRef(0)
  const [isEditor, setIsEditor] = useState<boolean | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  // naik saat user login/logout berganti → cek ulang status editor
  const [authKey, setAuthKey] = useState(0)
  const userId = useRef<string | null | undefined>(undefined)

  const setPreset = useCallback((p: Preset) => writePeriod({ ...readPeriod(), preset: p }), [])
  const setCustom = useCallback((r: Range) => writePeriod({ preset: 'custom', custom: r }), [])

  const track = useCallback(<T,>(p: Promise<T>): Promise<T> => {
    pending.current += 1
    return p.finally(() => {
      pending.current -= 1
      if (pending.current <= 0) {
        pending.current = 0
        setRefreshing(false)
      }
    })
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    setToday(todayWIB()) // "Hari ini" ikut bergeser bila lewat tengah malam
    setTick((t) => t + 1)
  }, [])

  // auto-refresh tiap 5 menit + saat aplikasi dibuka lagi dari background
  const lastTickAt = useRef(0)
  useEffect(() => {
    lastTickAt.current = Date.now()
  }, [tick])
  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastTickAt.current > 60_000) refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refresh])

  // status sinkronisasi VPS
  useEffect(() => {
    let alive = true
    const q = getSupabase()
      .from('sync_status')
      .select('last_run,status,note')
      .order('last_run', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setSync((data as SyncStatus | null) ?? null)
        setLastFetched(new Date())
      })
    track(Promise.resolve(q))
    return () => {
      alive = false
    }
  }, [tick, track])

  // ganti user (login/logout di tab lain, token berganti user) → status editor direset
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null
      if (userId.current !== undefined && userId.current !== id) {
        setIsEditor(null)
        setEditorError(null)
        setAuthKey((k) => k + 1)
      }
      userId.current = id
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // status editor: diambil sekali per sesi, diulang saat refresh() / user berganti.
  // Saat refresh, nilai lama tetap dipakai sampai jawaban baru datang (menu tidak berkedip).
  useEffect(() => {
    let alive = true
    track(fetchIsEditor())
      .then((v) => {
        if (!alive) return
        setIsEditor(v)
        setEditorError(null)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setIsEditor(false) // gagal cek = bukan editor
        setEditorError(errorMessage(e))
      })
    return () => {
      alive = false
    }
  }, [tick, authKey, track])

  const range = useMemo(() => rangeOf(period.preset, period.custom, today), [period, today])

  return (
    <DashCtx.Provider
      value={{
        preset: period.preset,
        custom: period.custom,
        range,
        today,
        setPreset,
        setCustom,
        tick,
        refresh,
        refreshing,
        track,
        sync,
        lastFetched,
        isEditor,
        editorError,
      }}
    >
      {children}
    </DashCtx.Provider>
  )
}

export function useDashboard(): Ctx {
  const c = useContext(DashCtx)
  if (!c) throw new Error('useDashboard harus di dalam DashboardProvider')
  return c
}

// ---------------- Query umum (ikut auto-refresh) ----------------

type QueryResult<T> = { key: string; tick: number; data: T | null; error: string | null }

/**
 * Jalankan fetcher setiap `key` berubah atau setiap refresh (5 menit / tombol).
 * key = null → tidak fetch. Ganti key → data dikosongkan (skeleton), kecuali keepPrevious;
 * refresh dengan key sama → data lama tetap tampil sampai data baru datang.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, opts: { keepPrevious?: boolean } = {}) {
  const { tick, track } = useDashboard()
  const [res, setRes] = useState<QueryResult<T>>({ key: '', tick: -1, data: null, error: null })
  const run = useEffectEvent(() => fetcher())

  useEffect(() => {
    if (key === null) return
    let alive = true
    track(run())
      .then((data) => {
        if (alive) setRes({ key, tick, data, error: null })
      })
      .catch((e: unknown) => {
        if (!alive) return
        const msg = errorMessage(e)
        setRes((prev) => ({ key, tick, data: prev.key === key ? prev.data : null, error: msg }))
      })
    return () => {
      alive = false
    }
  }, [key, tick, track])

  const same = key !== null && res.key === key
  return {
    // keepPrevious: data lama tetap tampil saat key berganti (mis. reload setelah simpan)
    data: same || opts.keepPrevious ? res.data : null,
    error: same ? res.error : null,
    loading: key !== null && (!same || res.tick !== tick),
  }
}

/** Ambil pesan error Supabase/JS apa adanya. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Terjadi kesalahan'
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    const o = e as { message?: string; code?: string; details?: string; hint?: string }
    const msg = o.message || o.details || o.hint || 'Terjadi kesalahan'
    if (o.code === 'PGRST106' || /schema must be one of the following/i.test(msg)) {
      return 'Schema ads belum di-expose di Supabase (Settings → Data API)'
    }
    return msg
  }
  return String(e)
}

// ---------------- Data ads_daily ----------------

const COLS =
  'date,brand,product,orders,gmv,spend,cpr,roas,profit,poas,npm,margin_per_order,fee_pct,cancel_pct,rts_pct,updated_at'
const PAGE = 1000

async function fetchRange(range: Range, brand?: string | null): Promise<AdsRow[]> {
  const sb = getSupabase()
  const out: AdsRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    let q = sb
      .from('ads_daily')
      .select(COLS)
      .gte('date', range.from)
      .lte('date', range.to)
      .order('date', { ascending: true })
      .order('brand', { ascending: true })
      .order('product', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (brand) q = q.eq('brand', brand)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as AdsRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/** Ambil baris ads_daily untuk rentang tanggal; ikut auto-refresh. */
export function useAdsRows(range: Range, brand?: string | null) {
  const { from, to } = range
  const { data, error, loading } = useQuery(`ads|${from}|${to}|${brand ?? ''}`, () => fetchRange({ from, to }, brand))
  return { rows: data, error, loading }
}
