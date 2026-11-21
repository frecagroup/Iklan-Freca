'use client'

// Kalender pemilih rentang tanggal dalam satu popup.
// Klik pertama = tanggal awal, klik kedua = tanggal akhir (otomatis ditukar bila lebih awal,
// klik tanggal yang sama dua kali = satu hari). Desktop: 2 bulan berdampingan; HP: 1 bulan (bottom sheet).
// Nilai selalu 'YYYY-MM-DD' (WIB).
import { useEffect, useRef, useState } from 'react'
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

type Pos = { mobile: boolean; top: number; bottom: number; up: boolean; left: number | null; right: number | null }
const POPUP_W = 720 // perkiraan lebar popup desktop: preset + 2 bulan
const POPUP_H = 400 // perkiraan tinggi popup desktop

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
  const [pos, setPos] = useState<Pos>({ mobile: true, top: 0, bottom: 0, up: false, left: 0, right: null })
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  // bulan paling kanan yang tampil (desktop: bulan ini & sebelumnya)
  const [view, setView] = useState<YM>(() => ymOf(value.to))

  const place = () => {
    const el = btnRef.current
    if (!el) return
    const mobile = window.matchMedia('(max-width: 639px)').matches
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    // rata kiri dengan tombol; kalau tidak muat, rata kanan dengan tombol
    const fitsLeft = r.left + POPUP_W <= vw - 8
    const left = fitsLeft ? r.left : null
    const right = fitsLeft ? null : Math.max(8, vw - r.right)
    // tidak muat di bawah tombol → tampilkan di atas
    const up = r.bottom + 8 + POPUP_H > vh - 8 && r.top - 8 - POPUP_H > 8
    setPos({ mobile, top: r.bottom + 8, bottom: vh - r.top + 8, up, left, right })
  }

  const openPicker = () => {
    setAnchor(null)
    setHover(null)
    setView(ymOf(value.to))
    place()
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
    const onMove = () => place()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

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
  const months = pos.mobile ? [view] : [ymAdd(view, -1), view]
  const canPrev = !min || ymKey(months[0]) > ymKey(ymOf(min))
  const activePreset = presets.find(([k]) => {
    const p = presetRange(k, today)
    return p.from === value.from && p.to === value.to
  })?.[0]

  const label = value.from && value.to ? rangeLabelFull(value.from, value.to) : (placeholder ?? 'Pilih tanggal')

  const popup = (
    <>
      <div className={cn('fixed inset-0 z-[55]', pos.mobile ? 'bg-black/50 backdrop-blur-sm' : '')} onClick={close} />
      <div
        role="dialog"
        aria-label={title}
        className={cn(
          'z-[56] animate-rise overflow-hidden border border-border bg-card shadow-2xl',
          pos.mobile ? 'fixed inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]' : 'fixed rounded-xl',
        )}
        style={
          pos.mobile
            ? undefined
            : {
                ...(pos.left !== null ? { left: pos.left } : { right: pos.right ?? 8 }),
                ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }),
                maxWidth: 'calc(100vw - 16px)',
              }
        }
      >
        {pos.mobile && (
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
        <div className={cn('flex', pos.mobile ? 'flex-col' : 'flex-row')}>
          {/* preset cepat */}
          {presets.length > 0 && (
            <div
              className={cn(
                pos.mobile
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
                    pos.mobile && activePreset !== k && 'bg-muted',
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
