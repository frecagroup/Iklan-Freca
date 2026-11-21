'use client'

// Kalender pemilih rentang tanggal dalam satu popup.
// Klik pertama = tanggal awal, klik kedua = tanggal akhir (otomatis ditukar bila lebih awal,
// klik tanggal yang sama dua kali = satu hari). Desktop: 2 bulan berdampingan; HP: 1 bulan (bottom sheet).
// Nilai selalu 'YYYY-MM-DD' (WIB).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { addDays, rangeLabelFull, todayWIB } from '@/lib/format'
import { cn } from '@/lib/cn'

export type DateRange = { from: string; to: string }
export type RangePresetKey = 'today' | 'yesterday' | '7' | '30' | 'month'

const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export const RANGE_PRESETS: Array<[RangePresetKey, string]> = [
  ['today', 'Hari ini'],
  ['yesterday', 'Kemarin'],
  ['7', '7 hari'],
  ['30', '30 hari'],
  ['month', 'Bulan ini'],
]

/** Rentang preset relatif terhadap `today` (WIB) */
export function presetRange(key: RangePresetKey, today: string = todayWIB()): DateRange {
  switch (key) {
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
    case 'month':
      return { from: `${today.slice(0, 7)}-01`, to: today }
  }
}

// ---------- util kalender (string ISO, tanpa efek zona waktu) ----------

type YM = { y: number; m: number } // m: 1–12
const ymOf = (iso: string): YM => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) })
const ymAdd = ({ y, m }: YM, n: number): YM => {
  const t = y * 12 + (m - 1) + n
  return { y: Math.floor(t / 12), m: (t % 12) + 1 }
}
const ymKey = ({ y, m }: YM) => y * 12 + m
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const daysIn = ({ y, m }: YM) => new Date(Date.UTC(y, m, 0)).getUTCDate()
/** 0 = Senin … 6 = Minggu */
const weekdayMon = ({ y, m }: YM, d: number) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7

function Month({
  ym,
  selFrom,
  selTo,
  anchor,
  max,
  min,
  today,
  onPick,
  onHover,
}: {
  ym: YM
  selFrom: string | null
  selTo: string | null
  anchor: string | null
  max?: string
  min?: string
  today: string
  onPick: (d: string) => void
  onHover: (d: string | null) => void
}) {
  const lead = weekdayMon(ym, 1)
  const total = daysIn(ym)
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => iso(ym.y, ym.m, i + 1))]
  while (cells.length % 7) cells.push(null)

  return (
    <div className="w-[16.5rem]">
      <p className="mb-2 text-center text-sm font-semibold text-foreground">
        {BULAN_PANJANG[ym.m - 1]} {ym.y}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {HARI.map((h) => (
          <span key={h} className="py-1">
            {h}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => onHover(null)}>
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} className="h-9" />
          const disabled = (max !== undefined && d > max) || (min !== undefined && d < min)
          const inRange = selFrom !== null && selTo !== null && d >= selFrom && d <= selTo
          const isStart = d === selFrom
          const isEnd = d === selTo
          const edge = isStart || isEnd
          const col = i % 7
          return (
            <div
              key={d}
              className={cn(
                'relative h-9',
                // pita warna muda untuk rentang (menyambung antar sel)
                inRange && 'bg-primary/15',
                inRange && (isStart || col === 0) && 'rounded-l-full',
                inRange && (isEnd || col === 6) && 'rounded-r-full',
              )}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(d)}
                onMouseEnter={() => !disabled && onHover(d)}
                onFocus={() => !disabled && onHover(d)}
                aria-label={d}
                aria-pressed={edge}
                className={cn(
                  'grid h-9 w-full place-items-center rounded-full text-sm tabular-nums transition-colors',
                  disabled && 'cursor-not-allowed text-muted-foreground/35',
                  !disabled && !edge && 'text-foreground hover:bg-primary/20',
                  edge && 'bg-primary font-bold text-primary-foreground shadow-sm',
                  !edge && d === today && 'font-bold underline decoration-primary decoration-2 underline-offset-4',
                  anchor === d && !selTo && 'ring-2 ring-primary/40',
                )}
              >
                {Number(d.slice(8, 10))}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// sheet = panel dari bawah (HP); drop = dropdown di bawah/atas tombol
type Layout = { mobile: boolean; months: 1 | 2 }

/** Lebar layar yang benar-benar terlihat (aman untuk HP lipat, zoom, & ukuran font besar) */
function viewportSize() {
  const vv = window.visualViewport
  const w = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth, vv?.width ?? Infinity)
  const h = Math.min(window.innerHeight, vv?.height ?? Infinity)
  return { w, h }
}

/** Pilih tata letak dari ruang yang tersedia (ukuran dalam rem → ikut skala font perangkat) */
function chooseLayout(): Layout {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const { w } = viewportSize()
  // preset 8rem + bulan 16.5rem + padding/gap ±1.5rem, sisakan margin 16px
  const one = (8 + 16.5 + 1.75) * rem + 16
  const two = (8 + 16.5 * 2 + 1.5 + 1.75) * rem + 16
  if (w < 640 || w < one) return { mobile: true, months: 1 }
  return { mobile: false, months: w >= two ? 2 : 1 }
}

export function DateRangePicker({
  value,
  onChange,
  max,
  min,
  presets = RANGE_PRESETS,
  active = true,
  className,
  buttonClassName,
  placeholder,
  title = 'Pilih rentang tanggal',
}: {
  value: DateRange
  /** preset = kunci preset bila dipilih dari daftar cepat */
  onChange: (r: DateRange, preset?: RangePresetKey) => void
  /** default: hari ini (WIB) — tanggal sesudahnya tidak bisa dipilih */
  max?: string
  min?: string
  presets?: Array<[RangePresetKey, string]>
  /** false = tombol tampil netral (mis. sedang memakai chip preset lain) */
  active?: boolean
  className?: string
  buttonClassName?: string
  placeholder?: string
  title?: string
}) {
  const today = todayWIB()
  const maxDate = max ?? today
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [layout, setLayout] = useState<Layout>({ mobile: true, months: 1 })
  const popRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  // bulan paling kanan yang tampil (desktop: bulan ini & sebelumnya)
  const [view, setView] = useState<YM>(() => ymOf(value.to))

  /** Posisikan dropdown dari ukuran ASLI popup supaya selalu di dalam layar */
  const placePopup = () => {
    const pop = popRef.current
    const btn = btnRef.current
    if (!pop || !btn || layout.mobile) return
    const { w: vw, h: vh } = viewportSize()
    const r = btn.getBoundingClientRect()
    pop.style.maxWidth = `${vw - 16}px`
    pop.style.maxHeight = `${vh - 16}px`
    const w = pop.offsetWidth
    const h = pop.offsetHeight
    // rata kiri dengan tombol; kalau tidak muat, rata kanan; selalu dijepit 8px dari tepi layar
    let left = r.left + w <= vw - 8 ? r.left : r.right - w
    left = Math.max(8, Math.min(left, vw - w - 8))
    // di bawah tombol; kalau tidak muat, di atas; kalau tetap tidak muat, sejajarkan ke tepi bawah layar
    let top = r.bottom + 8
    if (top + h > vh - 8) top = r.top - 8 - h >= 8 ? r.top - 8 - h : Math.max(8, vh - h - 8)
    pop.style.left = `${left}px`
    pop.style.top = `${top}px`
  }

  const openPicker = () => {
    setAnchor(null)
    setHover(null)
    setView(ymOf(value.to))
    setLayout(chooseLayout())
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    setAnchor(null)
    setHover(null)
  }

  // ikuti posisi tombol saat halaman di-scroll / di-resize; Esc menutup
  useEffect(() => {
    if (!open) return
    const onMove = () => {
      const next = chooseLayout()
      setLayout((cur) => (cur.mobile === next.mobile && cur.months === next.months ? cur : next))
      placePopup()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layout])

  // ukur & posisikan setelah popup tampil (sebelum digambar → tanpa kedip)
  useLayoutEffect(() => {
    if (open) placePopup()
  })

  const pick = (d: string) => {
    if (!anchor) {
      setAnchor(d)
      return
    }
    const r = anchor <= d ? { from: anchor, to: d } : { from: d, to: anchor }
    onChange(r)
    close()
  }

  const choosePreset = (k: RangePresetKey) => {
    onChange(presetRange(k, today), k)
    close()
  }

  // sorotan: saat memilih → anchor..hover (sementara); selain itu → nilai sekarang
  let selFrom: string | null = value.from
  let selTo: string | null = value.to
  if (anchor) {
    const other = hover ?? null
    if (other) {
      selFrom = anchor <= other ? anchor : other
      selTo = anchor <= other ? other : anchor
    } else {
      selFrom = anchor
      selTo = null
    }
  }

  const maxYM = ymOf(maxDate)
  const canNext = ymKey(view) < ymKey(maxYM)
  const months = layout.months === 1 ? [view] : [ymAdd(view, -1), view]
  const canPrev = !min || ymKey(months[0]) > ymKey(ymOf(min))
  const activePreset = presets.find(([k]) => {
    const p = presetRange(k, today)
    return p.from === value.from && p.to === value.to
  })?.[0]

  const label = value.from && value.to ? rangeLabelFull(value.from, value.to) : (placeholder ?? 'Pilih tanggal')

  const popup = (
    <>
      <div className={cn('fixed inset-0 z-[55]', layout.mobile ? 'bg-black/50 backdrop-blur-sm' : '')} onClick={close} />
      <div
        ref={popRef}
        role="dialog"
        aria-label={title}
        className={cn(
          'z-[56] animate-rise overflow-y-auto overscroll-contain border border-border bg-card shadow-2xl',
          layout.mobile
            ? 'fixed inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]'
            : 'fixed left-2 top-2 w-max rounded-xl',
        )}
      >
        {layout.mobile && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-base font-semibold text-foreground">{title}</span>
            <button
              type="button"
              onClick={close}
              aria-label="Tutup"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className={cn('flex', layout.mobile ? 'flex-col' : 'flex-row')}>
          {/* preset cepat */}
          {presets.length > 0 && (
            <div
              className={cn(
                layout.mobile
                  ? 'flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5'
                  : 'flex w-32 flex-shrink-0 flex-col gap-1 border-r border-border bg-muted/30 p-2',
              )}
            >
              {presets.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => choosePreset(k)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors',
                    activePreset === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    layout.mobile && activePreset !== k && 'bg-muted',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          <div className="p-3">
            <div className="relative flex justify-center gap-6">
              <button
                type="button"
                onClick={() => setView((v) => ymAdd(v, -1))}
                disabled={!canPrev}
                aria-label="Bulan sebelumnya"
                className="absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView((v) => ymAdd(v, 1))}
                disabled={!canNext}
                aria-label="Bulan berikutnya"
                className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {months.map((ym) => (
                <Month
                  key={ymKey(ym)}
                  ym={ym}
                  selFrom={selFrom}
                  selTo={selTo}
                  anchor={anchor}
                  max={maxDate}
                  min={min}
                  today={today}
                  onPick={pick}
                  onHover={setHover}
                />
              ))}
            </div>
            <p className="mt-2 border-t border-border pt-2 text-center text-xs text-muted-foreground">
              {anchor ? (
                <>
                  Mulai <b className="text-foreground">{rangeLabelFull(anchor, anchor)}</b> — klik tanggal akhir (klik tanggal yang sama untuk 1 hari)
                </>
              ) : (
                <>
                  Terpilih <b className="text-foreground">{label}</b> · klik tanggal awal lalu tanggal akhir
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
          active
            ? 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15'
            : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
          buttonClassName,
        )}
      >
        <CalendarDays className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : '')} />
        <span className="truncate tabular-nums">{label}</span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(popup, document.body)}
    </div>
  )
}
