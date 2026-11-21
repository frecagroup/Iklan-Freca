'use client'

import { Suspense, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftRight, History } from 'lucide-react'
import { Badge, Card, Field, selectClass } from '@/components/ui'
import { PillTabs } from '@/components/form'
import { ErrorBox, ProfitNote } from '@/components/metrics-view'
import { ProductTable } from '@/components/product-table'
import { CompareSummaryCards } from '@/components/compare/summary-cards'
import { CompareTable } from '@/components/compare/compare-table'
import { useDashboard, useQuery, type Range } from '@/lib/data'
import { addDays, dayCount, rangeLabel } from '@/lib/format'
import { BRANDS } from '@/lib/metrics'
import { fetchCompare, fetchPeriodSummary, splitSummary, type CompareArgs } from '@/lib/compare'
import { cn } from '@/lib/cn'

type Mode = 'periode' | 'toko'
type Level = 'product' | 'brand'
const ALL = 'semua'

const ISO = /^\d{4}-\d{2}-\d{2}$/
function parseRange(v: string | null, fallback: Range): Range {
  if (!v) return fallback
  const [from, to] = v.split('_')
  if (!ISO.test(from ?? '') || !ISO.test(to ?? '')) return fallback
  return from <= to ? { from, to } : { from: to, to: from }
}
const rangeParam = (r: Range) => `${r.from}_${r.to}`
const brandParam = (v: string | null) => {
  if (!v || v.toLowerCase() === ALL) return null
  return (BRANDS as readonly string[]).find((b) => b.toLowerCase() === v.toLowerCase()) ?? null
}
const brandName = (b: string | null) => b ?? 'Semua toko'

// ---------------- pemilih ----------------

function StoreSelect({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Field label={label}>
      <select value={value ?? ALL} onChange={(e) => onChange(brandParam(e.target.value))} className={selectClass()}>
        <option value={ALL}>Semua toko</option>
        {BRANDS.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
    </Field>
  )
}

function RangePicker({
  label,
  value,
  onChange,
  today,
  extra,
}: {
  label: string
  value: Range
  onChange: (r: Range) => void
  today: string
  extra?: React.ReactNode
}) {
  const presets: Array<[string, Range]> = [
    ['Hari ini', { from: today, to: today }],
    ['Kemarin', { from: addDays(today, -1), to: addDays(today, -1) }],
    ['7 Hari', { from: addDays(today, -6), to: today }],
    ['30 Hari', { from: addDays(today, -29), to: today }],
  ]
  const active = presets.find(([, r]) => r.from === value.from && r.to === value.to)?.[0] ?? 'Custom'
  const set = (r: Range) => onChange(r.from <= r.to ? r : { from: r.to, to: r.from })
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {rangeLabel(value.from, value.to)} · {dayCount(value.from, value.to)} hari
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {presets.map(([l, r]) => (
          <button
            key={l}
            onClick={() => set(r)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              active === l ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {l}
          </button>
        ))}
        <span
          className={cn(
            'rounded-lg px-2.5 py-1 text-xs font-medium',
            active === 'Custom' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground',
          )}
        >
          Custom
        </span>
        {extra}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Dari</span>
          <input
            type="date"
            value={value.from}
            max={today}
            onChange={(e) => e.target.value && set({ from: e.target.value, to: value.to })}
            className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Sampai</span>
          <input
            type="date"
            value={value.to}
            max={today}
            onChange={(e) => e.target.value && set({ from: value.from, to: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </label>
      </div>
    </div>
  )
}

// ---------------- halaman ----------------

function KomparasiInner() {
  const { today } = useDashboard()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const mode: Mode = params.get('mode') === 'toko' ? 'toko' : 'periode'
  const level: Level = params.get('level') === 'brand' ? 'brand' : 'product'

  const def7: Range = { from: addDays(today, -6), to: today }
  const defPrev: Range = { from: addDays(today, -13), to: addDays(today, -7) }

  // mode periode: satu toko, dua periode
  const pBrand = brandParam(params.get('brand'))
  const pA = parseRange(params.get('a'), defPrev)
  const pB = parseRange(params.get('b'), def7)
  // mode toko: dua toko, satu periode
  const tA = params.has('a') ? brandParam(params.get('a')) : 'Ghazal'
  const tB = params.has('b') ? brandParam(params.get('b')) : 'Sultan Kasturi'
  const tRange = parseRange(params.get('range'), def7)

  const update = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k)
      else sp.set(k, v)
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const switchMode = (m: Mode) => {
    if (m === mode) return
    if (m === 'toko') {
      // di mode periode, param a/b berisi tanggal → pakai toko terpilih sebagai A
      const a = pBrand ?? BRANDS[0]
      const b = BRANDS.find((x) => x !== a) ?? null
      update({ mode: 'toko', a, b: b ?? ALL, range: rangeParam(pB), brand: null })
    } else {
      update({ mode: 'periode', brand: tA ?? ALL, a: rangeParam(defPrev), b: rangeParam(def7), range: null })
    }
  }

  const sameStore = mode === 'toko' && (tA ?? ALL) === (tB ?? ALL)

  const args: CompareArgs | null = sameStore
    ? null
    : mode === 'periode'
      ? { a_brand: pBrand, a_from: pA.from, a_to: pA.to, b_brand: pBrand, b_from: pB.from, b_to: pB.to, p_level: level }
      : { a_brand: tA, a_from: tRange.from, a_to: tRange.to, b_brand: tB, b_from: tRange.from, b_to: tRange.to, p_level: level }

  const cmp = useQuery(args ? `cmp|${JSON.stringify(args)}` : null, () => fetchCompare(args!))

  // Toko vs Toko + per produk: tabel produk tiap toko berdampingan
  const showSides = mode === 'toko' && level === 'product' && !sameStore
  const sideA = useQuery(showSides ? `ps|${tRange.from}|${tRange.to}|${tA ?? ALL}` : null, () =>
    fetchPeriodSummary(tRange.from, tRange.to, tA ? [tA] : null),
  )
  const sideB = useQuery(showSides ? `ps|${tRange.from}|${tRange.to}|${tB ?? ALL}` : null, () =>
    fetchPeriodSummary(tRange.from, tRange.to, tB ? [tB] : null),
  )
  const splitA = useMemo(() => (sideA.data ? splitSummary(sideA.data) : null), [sideA.data])
  const splitB = useMemo(() => (sideB.data ? splitSummary(sideB.data) : null), [sideB.data])

  const labelA = mode === 'periode' ? rangeLabel(pA.from, pA.to) : brandName(tA)
  const labelB = mode === 'periode' ? rangeLabel(pB.from, pB.to) : brandName(tB)
  const subA = mode === 'periode' ? brandName(pBrand) : rangeLabel(tRange.from, tRange.to)
  const subB = subA

  const summary = cmp.data?.find((r) => r.row_type === 'summary') ?? null

  return (
    <div className="space-y-4">
      {/* ---------- pengaturan perbandingan ---------- */}
      <Card className="space-y-4 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PillTabs
            value={mode}
            onChange={switchMode}
            items={[
              ['toko', 'Toko vs Toko'],
              ['periode', 'Periode vs Periode'],
            ]}
          />
          <div className="sm:ml-auto">
            <PillTabs
              value={level}
              onChange={(l) => update({ level: l })}
              items={[
                ['product', 'Per produk'],
                ['brand', 'Per toko'],
              ]}
            />
          </div>
        </div>

        {mode === 'periode' ? (
          <>
            <div className="sm:max-w-xs">
              <StoreSelect label="Toko" value={pBrand} onChange={(v) => update({ brand: v ?? ALL })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <RangePicker
                  label="Periode A"
                  value={pA}
                  onChange={(r) => update({ a: rangeParam(r) })}
                  today={today}
                  extra={
                    <button
                      onClick={() => {
                        const len = dayCount(pB.from, pB.to)
                        update({ a: rangeParam({ from: addDays(pB.from, -len), to: addDays(pB.from, -1) }) })
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted/70"
                      title="Periode dengan panjang sama tepat sebelum Periode B"
                    >
                      <History className="h-3 w-3" /> Sebelum B
                    </button>
                  }
                />
              </div>
              <div className="rounded-lg border border-border p-3">
                <RangePicker label="Periode B" value={pB} onChange={(r) => update({ b: rangeParam(r) })} today={today} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <StoreSelect label="Toko A" value={tA} onChange={(v) => update({ a: v ?? ALL })} />
              <button
                onClick={() => update({ a: tB ?? ALL, b: tA ?? ALL })}
                className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-input text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Tukar toko A dan B"
                title="Tukar A ⇄ B"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <StoreSelect label="Toko B" value={tB} onChange={(v) => update({ b: v ?? ALL })} />
            </div>
            {sameStore && <p className="text-sm font-medium text-destructive">Toko A dan Toko B harus berbeda.</p>}
            <div className="rounded-lg border border-border p-3">
              <RangePicker label="Periode" value={tRange} onChange={(r) => update({ range: rangeParam(r) })} today={today} />
            </div>
          </>
        )}
      </Card>

      {/* ---------- label sisi ---------- */}
      {!sameStore && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['A', labelA, subA, summary?.a_has_running],
            ['B', labelB, subB, summary?.b_has_running],
          ].map(([k, l, sub, running]) => (
            <div key={k as string} className="min-w-0 rounded-lg border border-border bg-card px-3 py-2">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                <span className="grid h-5 w-5 place-items-center rounded bg-primary/15 text-[11px] font-bold text-primary">{k as string}</span>
                <span className="truncate">{l as string}</span>
                {running && <Badge tone="warning">berjalan</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{sub as string}</p>
            </div>
          ))}
        </div>
      )}

      {cmp.error && <ErrorBox message={cmp.error} />}

      {/* ---------- ringkasan ---------- */}
      {args && !cmp.error && (
        <>
          {summary ? (
            <CompareSummaryCards row={summary} labelA={labelA} labelB={labelB} />
          ) : cmp.data ? null : (
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------- toko vs toko: tabel produk tiap toko ---------- */}
      {showSides && (
        <div className="grid gap-4 xl:grid-cols-2">
          {[
            ['A', tA, splitA, sideA.error],
            ['B', tB, splitB, sideB.error],
          ].map(([k, b, split, err]) => {
            const s = split as ReturnType<typeof splitSummary> | null
            return (
              <section key={k as string} className="min-w-0 space-y-2">
                <h2 className="text-sm font-bold text-foreground">
                  {k as string} · {brandName(b as string | null)}
                  <span className="ml-1 font-normal text-muted-foreground">({rangeLabel(tRange.from, tRange.to)})</span>
                </h2>
                {err ? (
                  <ErrorBox message={err as string} />
                ) : s ? (
                  <ProductTable
                    items={s.items}
                    summary={
                      s.summary
                        ? { ...s.summary, profitIncomplete: s.summary.profit_incomplete }
                        : { orders: 0, gmv: 0, spend: 0, profit: 0, roas: null, poas: null, npm: null, cpr: null }
                    }
                  />
                ) : (
                  <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* ---------- tabel perbandingan ---------- */}
      {args && !cmp.error && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Perbandingan {level === 'product' ? 'per produk' : 'per toko'}
          </h2>
          {showSides && (
            <p className="text-xs text-muted-foreground">Nama produk antar toko biasanya berbeda, jadi baris terisi di satu sisi saja — itu normal.</p>
          )}
          {cmp.data ? (
            <CompareTable rows={cmp.data} labelA={labelA} labelB={labelB} level={level} />
          ) : (
            <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
          )}
          <p className="text-xs text-muted-foreground">
            Δ = B − A. Hijau = membaik, merah = memburuk (Spend & CPR naik dihitung memburuk). NPM selisih dalam poin persen.
          </p>
        </section>
      )}

      <ProfitNote />
    </div>
  )
}

export default function KomparasiPage() {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-xl border border-border bg-card" />}>
      <KomparasiInner />
    </Suspense>
  )
}
