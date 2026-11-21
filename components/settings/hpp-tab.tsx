'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, Download, History, Pencil, Plus, Search, Upload } from 'lucide-react'
import { Badge, Button } from '../ui'
import { BrandTabs } from '../brand-tabs'
import { ErrorBox } from '../metrics-view'
import { useToast } from '../toast'
import { HppEditModal } from './hpp-edit-modal'
import { HppHistoryDrawer } from './hpp-history'
import { HppImportModal } from './hpp-import'
import { errorMessage, useQuery } from '@/lib/data'
import { integer, rupiah, tanggal } from '@/lib/format'
import { exportHppCsv, exportHppXlsx } from '@/lib/hpp-file'
import { fetchHppCurrent, isInactive, type HppRow } from '@/lib/settings'
import type { Brand } from '@/lib/metrics'
import { cn } from '@/lib/cn'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Hanya dirender untuk editor (halaman Pengaturan sudah menyaring non-editor). */
export function HppTab() {
  const toast = useToast()
  const [ver, setVer] = useState(0)
  const reload = () => setVer((v) => v + 1)
  const { data, error } = useQuery(`hpp-current|${ver}`, fetchHppCurrent, { keepPrevious: true })

  const [brand, setBrand] = useState<Brand | null>(null)
  const [q, setQ] = useState('')
  const [hideInactive, setHideInactive] = useState(true)
  const [edit, setEdit] = useState<{ row: HppRow | null } | null>(null)
  const [history, setHistory] = useState<HppRow | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const [exporting, setExporting] = useState(false)

  const rows = useMemo(() => {
    if (!data) return null
    const needle = q.trim().toLowerCase()
    return data.filter((r) => {
      if (brand && r.brand !== brand) return false
      if (hideInactive && isInactive(r.catatan)) return false
      if (!needle) return true
      return [r.product_name, r.variant, r.sku_id].some((v) => v?.toLowerCase().includes(needle))
    })
  }, [data, brand, q, hideInactive])

  const doExport = async (kind: 'xlsx' | 'csv') => {
    setExportMenu(false)
    if (!data) return
    setExporting(true)
    try {
      if (kind === 'xlsx') await exportHppXlsx(data)
      else exportHppCsv(data)
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <BrandTabs active={brand} onSelect={(b) => setBrand(b as Brand | null)} withAll />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row md:items-center">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama produk, varian, atau SKU ID"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} className="h-4 w-4 accent-primary" />
          Sembunyikan produk nonaktif
        </label>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setExportMenu((o) => !o)} loading={exporting} disabled={!data}>
              <Download className="h-4 w-4" /> Export
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {exportMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setExportMenu(false)} />
                <div className="absolute left-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg md:left-auto md:right-0">
                  <button onClick={() => doExport('xlsx')} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted">
                    Excel (.xlsx)
                  </button>
                  <button onClick={() => doExport('csv')} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted">
                    CSV
                  </button>
                </div>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={!data}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button size="sm" onClick={() => setEdit({ row: null })}>
            <Plus className="h-4 w-4" /> Tambah SKU
          </Button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {rows && (
        <p className="text-xs text-muted-foreground">
          {integer(rows.length)} SKU{data && rows.length !== data.length ? ` dari ${integer(data.length)}` : ''} · klik baris untuk melihat
          riwayat
        </p>
      )}

      {!rows && !error && <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />}
      {rows && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                  <th className="sticky-col bg-muted px-3 py-2.5 text-left font-semibold">Nama Produk</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Varian</th>
                  <th className="px-3 py-2.5 text-left font-semibold">SKU ID</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Harga Jual</th>
                  <th className="px-3 py-2.5 text-right font-semibold">HPP</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Berlaku Mulai</th>
                  {/* relative: span sr-only (absolute) tidak boleh lolos keluar area scroll tabel di HP */}
                  <th className="relative px-3 py-2.5 text-right font-semibold">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      Tidak ada SKU yang cocok.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const inactive = isInactive(r.catatan)
                  return (
                    <tr
                      key={r.sku_id}
                      onClick={() => setHistory(r)}
                      className={cn('cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/40', inactive && 'opacity-60')}
                    >
                      <td className="sticky-col max-w-[200px] bg-card px-3 py-2.5 align-top sm:max-w-[300px]">
                        <p className="truncate font-medium text-foreground" title={r.product_name ?? ''}>
                          {r.product_name ?? '—'}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">{r.brand}</span>
                          {r.catatan && <Badge tone={inactive ? 'neutral' : 'warning'}>{r.catatan}</Badge>}
                        </div>
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5 align-top text-foreground">
                        <span className="line-clamp-2">{r.variant ?? '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[11px] text-muted-foreground">{r.sku_id}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-muted-foreground">
                        {rupiah(r.harga_jual)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-foreground">
                        {rupiah(r.hpp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top text-foreground">
                        {r.berlaku_mulai ? tanggal(r.berlaku_mulai) : '—'}
                        {r.perubahan_terjadwal && (
                          <div className="mt-0.5">
                            <Badge tone="warning">
                              <CalendarClock /> Terjadwal {ddmm(r.perubahan_terjadwal)}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top">
                        <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setHistory(r)}
                            aria-label="Riwayat"
                            title="Riwayat"
                            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <Button size="sm" variant="outline" onClick={() => setEdit({ row: r })}>
                            <Pencil className="h-3.5 w-3.5" /> Ubah
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit && <HppEditModal row={edit.row} onClose={() => setEdit(null)} onSaved={reload} />}
      {history && <HppHistoryDrawer row={history} onClose={() => setHistory(null)} onChanged={reload} />}
      {importOpen && <HppImportModal current={data ?? []} onClose={() => setImportOpen(false)} onDone={reload} />}
    </div>
  )
}
