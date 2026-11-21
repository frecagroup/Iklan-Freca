// Format angka & waktu — Indonesia, zona Asia/Jakarta

export const TZ = 'Asia/Jakarta'

const intFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

function num(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Rp1.234.567 (negatif: -Rp1.234.567) */
export function rupiah(v: number | null | undefined): string {
  const n = num(v)
  if (n === null) return '—'
  const s = intFmt.format(Math.round(Math.abs(n)))
  return `${n < 0 ? '-' : ''}Rp${s}`
}

/** Rupiah ringkas untuk sumbu grafik: Rp1,2jt / Rp850rb / Rp1,05M */
export function rupiahShort(v: number | null | undefined): string {
  const n = num(v)
  if (n === null) return '—'
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const d = (x: number, digits = 1) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(x)
  if (a >= 1e9) return `${sign}Rp${d(a / 1e9, 2)}M`
  if (a >= 1e6) return `${sign}Rp${d(a / 1e6)}jt`
  if (a >= 1e3) return `${sign}Rp${d(a / 1e3, 0)}rb`
  return `${sign}Rp${d(a, 0)}`
}

/** Angka desimal pakai koma: 3,45 */
export function decimal(v: number | null | undefined, digits = 2): string {
  const n = num(v)
  if (n === null) return '—'
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

/** Persen: 12,3% */
export function percent(v: number | null | undefined, digits = 1): string {
  const n = num(v)
  if (n === null) return '—'
  return `${decimal(n, digits)}%`
}

export function integer(v: number | null | undefined): string {
  const n = num(v)
  if (n === null) return '—'
  return intFmt.format(Math.round(n))
}

// ---------- tanggal (string ISO yyyy-mm-dd, selalu WIB) ----------

/** yyyy-mm-dd untuk "sekarang" di Asia/Jakarta */
export function todayWIB(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Tambah n hari ke tanggal ISO (aritmatika kalender murni, tanpa efek zona waktu) */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/** Daftar tanggal ISO inklusif from..to */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur)
  return out
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** 15 Nov 2026 */
export function tanggal(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${BULAN[m - 1]}${withYear ? ` ${y}` : ''}`
}

/** HH:MM (WIB) dari timestamptz */
export function jamWIB(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(d)
    .replace('.', ':')
}

/** Label rentang ringkas: "12–13 Nov", "12 Nov", "28 Okt – 3 Nov", tahun ditampilkan bila beda dengan tahun ini */
export function rangeLabel(from: string, to: string, thisYear: string = todayWIB().slice(0, 4)): string {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  const yr = (y: number) => (String(y) !== thisYear ? ` ${y}` : '')
  if (from === to) return `${d1} ${BULAN[m1 - 1]}${yr(y1)}`
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${BULAN[m1 - 1]}${yr(y1)}`
  if (y1 === y2) return `${d1} ${BULAN[m1 - 1]} – ${d2} ${BULAN[m2 - 1]}${yr(y1)}`
  return `${d1} ${BULAN[m1 - 1]} ${y1} – ${d2} ${BULAN[m2 - 1]} ${y2}`
}

/** Jumlah hari inklusif */
export function dayCount(from: string, to: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(to) - ms(from)) / 86_400_000) + 1
}
