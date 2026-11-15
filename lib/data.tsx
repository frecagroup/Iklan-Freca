'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getSupabase } from './supabase/client'
import { addDays, todayWIB } from './format'
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

export function rangeOf(preset: Preset, custom: Range): Range {
  const t = todayWIB()
  switch (preset) {
    case 'today':
      return { from: t, to: t }
    case 'yesterday': {
      const y = addDays(t, -1)
      return { from: y, to: y }
    }
    case '7':
      return { from: addDays(t, -6), to: t }
    case '30':
      return { from: addDays(t, -29), to: t }
    default:
      return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  }
}

export const REFRESH_MS = 5 * 60 * 1000

export type SyncStatus = { last_run: string | null; status: string | null; note: string | null }

type Ctx = {
  preset: Preset
  custom: Range
  range: Range
  setPreset: (p: Preset) => void
  setCustom: (r: Range) => void
  /** naik setiap auto-refresh / tombol refresh → memicu fetch ulang */
  tick: number
  refresh: () => void
  refreshing: boolean
  setRefreshing: (v: boolean) => void
  sync: SyncStatus | null
  lastFetched: Date | null
}

const DashCtx = createContext<Ctx | null>(null)

const STORE_KEY = 'freca-ads-period'

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<Preset>('today')
  const [custom, setCustomState] = useState<Range>(() => {
    const t = todayWIB()
    return { from: addDays(t, -6), to: t }
  })
  const [tick, setTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [today, setToday] = useState(todayWIB())

  // pulihkan pilihan periode (per tab)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY)
      if (raw) {
        const v = JSON.parse(raw) as { preset: Preset; custom: Range }
        if (v.preset) setPresetState(v.preset)
        if (v.custom?.from && v.custom?.to) setCustomState(v.custom)
      }
    } catch {
      /* abaikan */
    }
  }, [])

  const persist = (p: Preset, c: Range) => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ preset: p, custom: c }))
    } catch {
      /* abaikan */
    }
  }
  const setPreset = (p: Preset) => {
    setPresetState(p)
    persist(p, custom)
  }
  const setCustom = (r: Range) => {
    setCustomState(r)
    setPresetState('custom')
    persist('custom', r)
  }

  const refresh = useCallback(() => {
    setToday(todayWIB()) // "Hari ini" ikut bergeser bila lewat tengah malam
    setTick((t) => t + 1)
  }, [])

  // auto-refresh tiap 5 menit + saat aplikasi dibuka lagi dari background
  const lastTickAt = useRef(Date.now())
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
    getSupabase()
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
    return () => {
      alive = false
    }
  }, [tick])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const range = useMemo(() => rangeOf(preset, custom), [preset, custom, today])

  return (
    <DashCtx.Provider
      value={{ preset, custom, range, setPreset, setCustom, tick, refresh, refreshing, setRefreshing, sync, lastFetched }}
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
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as AdsRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/** Ambil baris ads_daily untuk rentang tanggal; ikut auto-refresh. */
export function useAdsRows(range: Range, brand?: string | null) {
  const { tick, setRefreshing } = useDashboard()
  const [rows, setRows] = useState<AdsRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const key = `${range.from}|${range.to}|${brand ?? ''}`
  const prevKey = useRef(key)

  useEffect(() => {
    let alive = true
    // ganti periode → tampilkan skeleton; refresh periode sama → data lama tetap tampil
    if (prevKey.current !== key) setRows(null)
    prevKey.current = key
    setLoading(true)
    setRefreshing(true)
    fetchRange(range, brand)
      .then((r) => {
        if (!alive) return
        setRows(r)
        setError(null)
      })
      .catch((e: Error) => alive && setError(e.message || 'Gagal memuat data'))
      .finally(() => {
        if (!alive) return
        setLoading(false)
        setRefreshing(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])

  return { rows, error, loading }
}
