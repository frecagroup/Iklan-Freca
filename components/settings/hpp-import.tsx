'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { Badge, Button, Field, Modal, selectClass } from '../ui'
import { DateInput, PillTabs } from '../form'
import { useToast } from '../toast'
import { errorMessage, useDashboard } from '@/lib/data'
import { integer, rupiah, tanggal } from '@/lib/format'
import { BRANDS, type Brand } from '@/lib/metrics'
import { parseHppFile, type ParsedFile } from '@/lib/hpp-file'
import {
  BRAND_SECTION,
  brandFromSection,
  importHpp,
  normalizeBrand,
  type HppRow,
  type ImportResult,
  type ImportRow,
} from '@/lib/settings'
import { cn } from '@/lib/cn'

type Status = 'berubah' | 'baru' | 'sama' | 'invalid'
type PreviewRow = {
  key: string
  status: Status
  reason: string | null
  sheet: string
  rowNo: number
  sku: string
  name: string
  variant: string | null
  oldHpp: number | null
  newHpp: number | null
  payload: ImportRow | null
}

const STATUS_LABEL: Record<Status, string> = { berubah: 'Berubah', baru: 'SKU baru', sama: 'Sama', invalid: 'Tidak valid' }
const STATUS_TONE: Record<Status, 'primary' | 'success' | 'neutral' | 'destructive'> = {
  berubah: 'primary',
  baru: 'success',
  sama: 'neutral',
  invalid: 'destructive',
}

function buildPreview(file: ParsedFile, current: HppRow[], fallbackBrand: Brand | ''): PreviewRow[] {
  const bySku = new Map(current.map((r) => [r.sku_id, r]))
  const seen = new Set<string>()
  return file.rows.map((r) => {
    const existing = r.sku_id ? bySku.get(r.sku_id) : undefined
    const sheetSection = file.kind === 'xlsx' ? r.sheet : null
    const brand =
      normalizeBrand(r.brand) ??
      brandFromSection(r.section) ??
      brandFromSection(sheetSection) ??
      normalizeBrand(existing?.brand) ??
      (fallbackBrand || null)
    const section =
      r.section ?? sheetSection ?? existing?.section ?? (brand ? BRAND_SECTION[brand] : null)

    let status: Status
    let reason = r.problem
    if (!reason && !brand) reason = 'Brand tidak diketahui — pilih brand di atas'
    if (!reason && seen.has(r.sku_id)) reason = 'SKU ganda di file (baris ini diabaikan)'
    if (r.sku_id) seen.add(r.sku_id)

    if (reason) status = 'invalid'
    else if (!existing) status = 'baru'
    else if (Number(existing.hpp ?? NaN) !== r.hpp) status = 'berubah'
    else status = 'sama'

    return {
      key: `${r.sheet}-${r.rowNo}`,
      status,
      reason,
      sheet: r.sheet,
      rowNo: r.rowNo,
      sku: r.sku_id,
      name: r.product_name ?? existing?.product_name ?? '—',
      variant: r.variant ?? existing?.variant ?? null,
      oldHpp: existing?.hpp ?? null,
      newHpp: r.hpp,
      payload:
        status === 'invalid' || !brand || r.hpp === null
          ? null
          : {
              brand,
              section,
              sku_id: r.sku_id,
              product_id: r.product_id,
              product_name: r.product_name,
              variant: r.variant,
              harga_jual: r.harga_jual,
              hpp: r.hpp,
              catatan: r.catatan,
            },
    }
  })
}

export function HppImportModal({ current, onClose, onDone }: { current: HppRow[]; onClose: () => void; onDone: () => void }) {
  const { today } = useDashboard()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [parsing, setParsing] = useState(false)
  const [fallbackBrand, setFallbackBrand] = useState<Brand | ''>('')
  const [berlaku, setBerlaku] = useState(today)
  const [filter, setFilter] = useState<'changes' | 'invalid' | 'all'>('changes')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const preview = useMemo(() => (parsed ? buildPreview(parsed, current, fallbackBrand) : []), [parsed, current, fallbackBrand])
  const counts = useMemo(() => {
    const c: Record<Status, number> = { berubah: 0, baru: 0, sama: 0, invalid: 0 }
    preview.forEach((p) => c[p.status]++)
    return c
  }, [preview])
  // brand perlu dipilih manual bila ada baris yang brand-nya tidak bisa ditebak
  const needBrand = useMemo(
    () => !!parsed && (fallbackBrand !== '' || preview.some((p) => p.reason?.startsWith('Brand tidak diketahui'))),
    [parsed, preview, fallbackBrand],
  )
  const shown = preview.filter((p) =>
    filter === 'all' ? true : filter === 'invalid' ? p.status === 'invalid' : p.status === 'berubah' || p.status === 'baru',
  )

  const pick = async (f: File | undefined) => {
    if (!f) return
    setParsing(true)
    setResult(null)
    try {
      const pf = await parseHppFile(f)
      setParsed(pf)
      setFileName(f.name)
      setFilter('changes')
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setParsing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const save = async () => {
    const rows = preview.map((p) => p.payload).filter((p): p is ImportRow => p !== null)
    if (rows.length === 0) return toast.show('Tidak ada baris valid untuk disimpan', 'bad')
    if (berlaku < today) return toast.show('Tanggal berlaku tidak boleh sebelum hari ini', 'bad')
    setSaving(true)
    try {
      const res = await importHpp(rows, berlaku)
      setResult(res)
      toast.show(`Import selesai: ${res.dibuat} versi baru`, 'ok')
      onDone()
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setSaving(false)
    }
  }

  const validCount = counts.berubah + counts.baru + counts.sama

  return (
    <Modal
      open
      onClose={onClose}
      title="Import HPP"
      size="xl"
      footer={
        result ? (
          <div className="flex justify-end">
            <Button onClick={onClose}>Selesai</Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={save} loading={saving} disabled={!parsed || validCount === 0}>
              Simpan perubahan
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">Import selesai — berlaku mulai {tanggal(berlaku)}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Versi baru dibuat', result.dibuat, 'text-success'],
              ['Tidak berubah', result.tidak_berubah, 'text-foreground'],
              ['Ditolak', result.ditolak, result.ditolak > 0 ? 'text-destructive' : 'text-foreground'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl border border-border p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums', c as string)}>{integer(v as number)}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          {result.pesan.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Pesan dari database</p>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm text-foreground">
                {result.pesan.map((m, i) => (
                  <li key={i} className="break-words">
                    • {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <input ref={inputRef} type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={parsing}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
          >
            {parsed ? <FileSpreadsheet className="h-7 w-7 text-primary" /> : <Upload className="h-7 w-7 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground">
              {parsing ? 'Membaca file…' : parsed ? fileName : 'Pilih file .xlsx / .csv'}
            </span>
            <span className="text-xs text-muted-foreground">
              {parsed
                ? `${parsed.sheets.length} sheet · ${integer(parsed.rows.length)} baris — klik untuk ganti file`
                : 'Format Master HPP Freca: SKU ID, Product ID, Nama Produk, Nama SKU/Varian, Harga Jual, HPP, Catatan'}
            </span>
          </button>

          {parsed && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Berlaku mulai">
                  <DateInput value={berlaku} onChange={setBerlaku} min={today} />
                </Field>
                {needBrand && (
                  <Field label="Brand untuk baris tanpa brand">
                    <select value={fallbackBrand} onChange={(e) => setFallbackBrand(e.target.value as Brand | '')} className={selectClass()}>
                      <option value="">Pilih brand…</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="primary">{counts.berubah} berubah</Badge>
                <Badge tone="success">{counts.baru} SKU baru</Badge>
                <Badge tone="neutral">{counts.sama} sama</Badge>
                {counts.invalid > 0 && (
                  <Badge tone="destructive">
                    <AlertTriangle /> {counts.invalid} tidak valid
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Hanya SKU yang HPP-nya berubah yang dibuatkan versi baru. Baris tidak valid tidak dikirim.
              </p>

              <div className="overflow-x-auto">
                <PillTabs
                  value={filter}
                  onChange={setFilter}
                  items={[
                    ['changes', `Berubah & baru (${counts.berubah + counts.baru})`],
                    ['invalid', `Tidak valid (${counts.invalid})`],
                    ['all', `Semua (${preview.length})`],
                  ]}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="max-h-[45vh] overflow-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="sticky top-0 z-[2]">
                      <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                        <th className="sticky-col bg-muted px-3 py-2 text-left font-semibold">Produk</th>
                        <th className="px-3 py-2 text-left font-semibold">Status</th>
                        <th className="px-3 py-2 text-right font-semibold">HPP lama</th>
                        <th className="px-3 py-2 text-right font-semibold">HPP baru</th>
                        <th className="px-3 py-2 text-right font-semibold">Selisih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                            Tidak ada baris di filter ini.
                          </td>
                        </tr>
                      )}
                      {shown.map((p) => {
                        const diff = p.oldHpp !== null && p.newHpp !== null ? p.newHpp - p.oldHpp : null
                        return (
                          <tr key={p.key} className="border-b border-border/70 last:border-0">
                            <td className="sticky-col max-w-[220px] bg-card px-3 py-2 align-top">
                              <p className="truncate font-medium text-foreground" title={p.name}>
                                {p.name}
                              </p>
                              {p.variant && <p className="truncate text-xs text-muted-foreground">{p.variant}</p>}
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {p.sku || '—'} · {p.sheet} baris {p.rowNo}
                              </p>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                              {p.reason && <p className="mt-1 max-w-[220px] text-xs text-destructive">{p.reason}</p>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-muted-foreground">
                              {rupiah(p.oldHpp)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-foreground">
                              {rupiah(p.newHpp)}
                            </td>
                            <td
                              className={cn(
                                'whitespace-nowrap px-3 py-2 text-right align-top tabular-nums',
                                diff === null || diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-destructive' : 'text-success',
                              )}
                            >
                              {diff === null ? '—' : `${diff > 0 ? '+' : ''}${rupiah(diff)}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
