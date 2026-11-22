'use client'

// Panel creative/video GMV Max untuk satu produk (isi collapse di Detail Brand).
// Data per halaman dari RPC ads.creative_period_summary (pagination di server).
import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Info, Lock } from 'lucide-react'
import { Badge, Button, selectClass } from './ui'
import { RupiahInput } from './form'
import { useToast } from './toast'
import { LastUpdate, useSyncHealth } from './update-status'
import { errorMessage, useDashboard, useQuery } from '@/lib/data'
import { decimal, integer, rupiah } from '@/lib/format'
import {
  CREATIVE_FILTERS,
  PAGE_SIZES,
  fetchCreativePage,
  fetchCreativeUpdatedAt,
  isLearning,
  isProductCard,
  setCprTarget,
  statusLabel,
  toggleCreative,
  toggleIsOn,
  waitingSync,
  type CreativeFilter,
  type CreativeRow,
  type CreativeSort,
  type SortDir,
} from '@/lib/creative'
import { cn } from '@/lib/cn'

/** Video Learning dengan pesanan < ini: CPR tinggi diberi warna lembut, bukan alarm */
const LEARNING_MIN_ORDERS = 5

// Kolom judul video sengaja tidak ditampilkan (tabel lebih pendek); judul ada di tooltip ID Post.
type Col = { key: Exclude<CreativeSort, 'title'> | null; label: string; num?: boolean }
const COLS: Col[] = [
  { key: null, label: 'ID Post' },
  { key: null, label: 'Akun' },
  { key: null, label: 'Status' },
  { key: 'spend', label: 'Spend Iklan', num: true },
  { key: 'gmv', label: 'GMV', num: true },
  { key: 'orders', label: 'Pesanan', num: true },
  { key: 'cpr', label: 'CPR', num: true },
  { key: 'roas', label: 'ROAS', num: true },
  { key: null, label: 'On/Off' },
]

function Switch({
  on,
  disabled,
  loading,
  onClick,
  label,
}: {
  on: boolean
  disabled: boolean
  loading?: boolean
  onClick?: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        // area ketuk 44px, saklar 44×24
        'relative inline-flex h-11 w-14 flex-shrink-0 items-center justify-center rounded-full',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          on ? 'bg-success' : 'bg-muted-foreground/30',
          disabled && 'opacity-45',
        )}
      >
        <span
          className={cn(
            'grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        >
          {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
        </span>
      </span>
    </button>
  )
}

function TargetEditor({
  brand,
  product,
  target,
  canEdit,
  onSaved,
}: {
  brand: string
  product: string
  target: number | null
  canEdit: boolean
  onSaved: () => void
}) {
  const toast = useToast()
  const [val, setVal] = useState<number | null>(target)
  const [saving, setSaving] = useState(false)
  // ads.set_cpr_target hanya menerima angka > 0 (hapus target belum didukung di database)
  const valid = val !== null && val > 0
  const canSave = valid && val !== target

  if (!canEdit) {
    return (
      <span className="text-xs text-muted-foreground">
        Target CPR: <b className="text-foreground">{target === null ? 'Belum diset' : rupiah(target)}</b>
      </span>
    )
  }

  const save = async () => {
    if (val === null || val <= 0) return toast.show('Target CPR harus angka lebih dari 0', 'bad')
    setSaving(true)
    try {
      await setCprTarget(brand, product, val)
      toast.show(`Target CPR ${product}: ${rupiah(val)}`, 'ok')
      onSaved()
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">Target CPR</span>
      <div className="w-36">
        <RupiahInput value={val} onChange={setVal} placeholder="Belum diset" />
      </div>
      <Button size="sm" onClick={save} loading={saving} disabled={!canSave}>
        Simpan
      </Button>
      {!valid && val !== target && target !== null && (
        <button type="button" onClick={() => setVal(target)} className="text-xs font-medium text-primary hover:underline">
          Batal
        </button>
      )}
    </div>
  )
}

export function CreativePanel({
  brand,
  product,
  target,
  canEdit,
  onTargetSaved,
  targetVersion,
}: {
  brand: string
  product: string
  /** target CPR produk ini (null = belum diset) */
  target: number | null
  /** lolos ads.is_creative_editor() */
  canEdit: boolean
  onTargetSaved: () => void
  /** naik setiap target disimpan → muat ulang (cpr_over_target ikut berubah) */
  targetVersion: number
}) {
  const { range } = useDashboard()
  const toast = useToast()
  const sync = useSyncHealth()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [sort, setSort] = useState<{ key: CreativeSort; dir: SortDir }>({ key: 'spend', dir: 'desc' })
  const [filter, setFilter] = useState<CreativeFilter>('berbiaya')
  const [ver, setVer] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [toggledOnce, setToggledOnce] = useState(false)

  const args = { from: range.from, to: range.to, brand, product, page, pageSize, sort: sort.key, dir: sort.dir, filter }
  const q = useQuery(`creative|${JSON.stringify(args)}|${ver}|${targetVersion}`, () => fetchCreativePage(args), { keepPrevious: true })
  const upd = useQuery(`creative-upd|${range.from}|${range.to}|${brand}|${product}|${ver}`, () =>
    fetchCreativeUpdatedAt(range.from, range.to, brand, product),
  )

  const rows = q.data?.rows ?? []
  const total = q.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(total, page * pageSize)

  // Terakhir update produk ini: RPC → max(last_updated_at) halaman ini → sync VPS
  const pageMax = rows.reduce<string | null>((m, r) => (r.last_updated_at && (!m || r.last_updated_at > m) ? r.last_updated_at : m), null)
  const updatedAt = upd.data ?? pageMax ?? sync.sync?.last_run ?? null

  const changeSort = (key: CreativeSort) => {
    setPage(1)
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  }

  const doToggle = async (r: CreativeRow) => {
    if (!r.item_group_id) return toast.show('item_group_id kosong — tidak bisa diubah', 'bad')
    const on = toggleIsOn(r)
    setBusy(r.item_id)
    try {
      const res = await toggleCreative({ brand, product, item_group_id: r.item_group_id, item_id: r.item_id, action: on ? 'REMOVE' : 'ADD' })
      toast.show(res.message || (on ? 'Video dimatikan' : 'Video dinyalakan'), 'ok')
      setToggledOnce(true)
      setVer((v) => v + 1)
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setBusy(null)
    }
  }

  const anyWaiting = rows.some(waitingSync)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" onClick={(e) => e.stopPropagation()}>
      {/* ---------- header ---------- */}
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Clapperboard className="h-4 w-4 text-primary" /> Video GMV Max
          </span>
          <LastUpdate ts={updatedAt} danger={!sync.healthy} title={sync.sync?.note ?? undefined} />
        </div>
        <div className="lg:ml-auto">
          <TargetEditor key={`${target}`} brand={brand} product={product} target={target} canEdit={canEdit} onSaved={onTargetSaved} />
        </div>
      </div>

      {/* ---------- filter ---------- */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        {CREATIVE_FILTERS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setFilter(k)
              setPage(1)
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter === k ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {l}
          </button>
        ))}
        {!canEdit && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> On/off hanya untuk admin iklan
          </span>
        )}
      </div>

      {q.error && <p className="mx-3 mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{q.error}</p>}

      {/* ---------- tabel ---------- */}
      <div className="overflow-x-auto">
        <table className={cn('w-full min-w-[640px] border-collapse text-xs sm:min-w-[780px]', q.loading && rows.length > 0 && 'opacity-60')}>
          <thead>
            <tr className="border-y border-border bg-muted/60 text-muted-foreground">
              {COLS.map((c, i) => {
                const active = c.key !== null && sort.key === c.key
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={c.label}
                    className={cn(
                      'whitespace-nowrap px-2.5 py-2 font-semibold',
                      c.num ? 'text-right' : 'text-left',
                      i === 0 && 'sticky-col bg-muted',
                      c.label === 'On/Off' && 'text-center',
                    )}
                  >
                    {c.key ? (
                      <button
                        type="button"
                        onClick={() => changeSort(c.key!)}
                        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground', c.num && 'flex-row-reverse')}
                      >
                        {c.label}
                        <Icon className={cn('h-3 w-3', !active && 'opacity-40')} />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {!q.data && !q.error && (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-3">
                  <div className="h-24 animate-pulse rounded-lg bg-muted/60" />
                </td>
              </tr>
            )}
            {q.data && rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-6 text-left text-muted-foreground">
                  <span className="sticky left-3">Tidak ada video untuk filter ini di periode terpilih.</span>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const card = isProductCard(r)
              const st = statusLabel(r)
              const on = toggleIsOn(r)
              // CPR di atas target: alarm penuh, kecuali video Uji yang pesanannya masih sedikit (warna lembut)
              const softOver = r.cpr_over_target && isLearning(r) && r.orders < LEARNING_MIN_ORDERS
              const hardOver = r.cpr_over_target && !softOver
              const interactive = canEdit && r.toggle_allowed && !card
              const wait = waitingSync(r)
              const rowBg = hardOver ? 'var(--color-destructive)' : softOver ? 'var(--color-warning)' : null
              return (
                <tr
                  key={r.item_id + (r.item_group_id ?? '')}
                  className={cn('border-b border-border/70 last:border-0', hardOver && 'bg-destructive/5', softOver && 'bg-warning/5')}
                >
                  <td
                    className="sticky-col whitespace-nowrap bg-card px-2.5 py-2 align-top font-mono text-[11px]"
                    style={rowBg ? { background: `color-mix(in srgb, ${rowBg} 5%, var(--color-card))` } : undefined}
                  >
                    {card ? (
                      <span className="text-muted-foreground">{r.item_id}</span>
                    ) : (
                      <a
                        href={`https://www.tiktok.com/@/video/${encodeURIComponent(r.item_id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                        title={r.title ? `${r.item_id} — ${r.title}` : r.item_id}
                      >
                        {/* HP: 8 digit terakhir supaya kolom tidak terlalu lebar; tautan tetap ID penuh */}
                        <span className="sm:hidden">…{r.item_id.slice(-8)}</span>
                        <span className="hidden sm:inline">{r.item_id}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="max-w-[140px] truncate px-2.5 py-2 align-top text-muted-foreground" title={r.tt_account_name ?? ''}>
                    {r.tt_account_name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 align-top">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {wait && <p className="mt-1 text-[10px] font-medium text-warning">Menunggu sync</p>}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums text-foreground">{rupiah(r.spend)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums">{rupiah(r.gmv)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums">{integer(r.orders)}</td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums',
                      hardOver ? 'font-semibold text-destructive' : softOver ? 'font-semibold text-warning' : '',
                    )}
                  >
                    {rupiah(r.cpr)}
                    {/* badge peringatan CPR (dulu di sel judul) */}
                    {hardOver && (
                      <span className="mt-1 flex justify-end">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-destructive px-1.5 py-px text-[10px] font-bold text-white">
                          <AlertTriangle className="h-2.5 w-2.5" /> CPR di atas target
                        </span>
                      </span>
                    )}
                    {softOver && (
                      <span className="mt-1 flex justify-end" title={`Masih tahap uji dengan ${r.orders} pesanan`}>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning/20 px-1.5 py-px text-[10px] font-semibold text-foreground">
                          CPR tinggi · masih uji
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums">{decimal(r.roas)}</td>
                  <td className="whitespace-nowrap px-1 py-0.5 text-center align-top">
                    <div className="flex flex-col items-center">
                      <Switch
                        on={on}
                        disabled={!interactive}
                        loading={busy === r.item_id}
                        onClick={interactive ? () => doToggle(r) : undefined}
                        label={
                          card
                            ? 'Kartu produk tidak bisa di-on/off'
                            : !canEdit
                              ? `${on ? 'On' : 'Off'} — hanya admin iklan yang bisa mengubah`
                              : !r.toggle_allowed
                                ? `${on ? 'On' : 'Off'} — tidak ada kampanye GMV Max aktif`
                                : on
                                  ? 'Matikan (keluarkan dari kampanye)'
                                  : 'Nyalakan (masukkan ke kampanye)'
                        }
                      />
                      {card && <span className="-mt-1 text-[10px] leading-tight text-muted-foreground">Tidak bisa di-on/off</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(toggledOnce || anyWaiting) && (
        <p className="flex items-start gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" />
          Status di laporan TikTok bisa tertunda sampai ±20 menit; angka di dashboard ikut sync tiap 5 menit.
        </p>
      )}

      {/* ---------- pagination ---------- */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          Menampilkan <b className="text-foreground">{integer(startIdx)}</b>–<b className="text-foreground">{integer(endIdx)}</b> dari{' '}
          <b className="text-foreground">{integer(total)}</b>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Baris
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className={cn(selectClass(), 'h-9 w-auto py-1 text-xs')}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || q.loading}
            aria-label="Halaman sebelumnya"
            className="grid h-9 w-9 place-items-center rounded-lg border border-input text-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[3.5rem] text-center tabular-nums text-muted-foreground">
            {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages || q.loading}
            aria-label="Halaman berikutnya"
            className="grid h-9 w-9 place-items-center rounded-lg border border-input text-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
