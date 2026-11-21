'use client'

// Export / import file Master HPP Freca (.xlsx satu sheet per section, atau .csv).
import { todayWIB } from './format'
import { BRAND_SECTION, normalizeBrand, type HppRow } from './settings'

export const HPP_HEADERS = ['SKU ID', 'Product ID', 'Nama Produk', 'Nama SKU/Varian', 'Harga Jual', 'HPP', 'Catatan'] as const

type ExcelJSModule = typeof import('exceljs')

async function loadExcel(): Promise<ExcelJSModule> {
  const mod = (await import('exceljs')) as unknown as ExcelJSModule & { default?: ExcelJSModule }
  return mod.default ?? mod
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function sectionOf(r: HppRow): string {
  if (r.section && r.section.trim()) return r.section.trim()
  const b = normalizeBrand(r.brand)
  return b ? BRAND_SECTION[b] : r.brand || 'Lainnya'
}

/** Nama sheet Excel: maks 31 karakter, tanpa : \ / ? * [ ] */
function sheetName(s: string, used: Set<string>): string {
  let base = s.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet'
  let name = base
  let i = 2
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${i++})`
    base = base.slice(0, 31 - suffix.length)
    name = base + suffix
  }
  used.add(name.toLowerCase())
  return name
}

export async function exportHppXlsx(rows: HppRow[]) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Freca Ads'
  wb.created = new Date()

  const groups = new Map<string, HppRow[]>()
  for (const r of rows) {
    const k = sectionOf(r)
    const g = groups.get(k)
    if (g) g.push(r)
    else groups.set(k, [r])
  }
  const order = Object.values(BRAND_SECTION)
  const sections = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'id')
  })

  const used = new Set<string>()
  for (const sec of sections) {
    const ws = wb.addWorksheet(sheetName(sec, used), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [
      { header: HPP_HEADERS[0], key: 'sku', width: 22, style: { numFmt: '@' } },
      { header: HPP_HEADERS[1], key: 'pid', width: 22, style: { numFmt: '@' } },
      { header: HPP_HEADERS[2], key: 'name', width: 46 },
      { header: HPP_HEADERS[3], key: 'variant', width: 28 },
      { header: HPP_HEADERS[4], key: 'harga', width: 14, style: { numFmt: '#,##0' } },
      { header: HPP_HEADERS[5], key: 'hpp', width: 14, style: { numFmt: '#,##0' } },
      { header: HPP_HEADERS[6], key: 'catatan', width: 18 },
    ]
    const head = ws.getRow(1)
    head.font = { bold: true }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1FB' } }
    const list = groups.get(sec)!.slice().sort((a, b) => (a.product_name ?? '').localeCompare(b.product_name ?? '', 'id'))
    for (const r of list) {
      // ID TikTok 19 digit → simpan sebagai teks supaya tidak dibulatkan Excel
      ws.addRow({
        sku: r.sku_id,
        pid: r.product_id ?? '',
        name: r.product_name ?? '',
        variant: r.variant ?? '',
        harga: r.harga_jual ?? null,
        hpp: r.hpp ?? null,
        catatan: r.catatan ?? '',
      })
    }
  }
  if (sections.length === 0) wb.addWorksheet('Ghazal').addRow([...HPP_HEADERS])

  const buf = await wb.xlsx.writeBuffer()
  download(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Master-HPP-Freca-${todayWIB()}.xlsx`,
  )
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV satu file: kolom Brand & Section di depan supaya bisa di-import ulang. */
export function exportHppCsv(rows: HppRow[]) {
  const header = ['Brand', 'Section', ...HPP_HEADERS]
  const lines = [header.map(csvCell).join(',')]
  for (const r of rows) {
    lines.push(
      [r.brand, sectionOf(r), r.sku_id, r.product_id ?? '', r.product_name ?? '', r.variant ?? '', r.harga_jual ?? '', r.hpp ?? '', r.catatan ?? '']
        .map(csvCell)
        .join(','),
    )
  }
  // BOM supaya Excel membaca UTF-8 dengan benar
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `Master-HPP-Freca-${todayWIB()}.csv`)
}

// ---------------- import ----------------

export type ParsedRow = {
  sheet: string
  rowNo: number
  brand: string | null
  section: string | null
  sku_id: string
  product_id: string | null
  product_name: string | null
  variant: string | null
  harga_jual: number | null
  hpp: number | null
  catatan: string | null
  /** masalah saat membaca file (mis. HPP bukan angka) */
  problem: string | null
}

export type ParsedFile = { kind: 'xlsx' | 'csv'; sheets: string[]; rows: ParsedRow[]; hasBrandColumn: boolean }

/** "Rp12.500" / "12.500" / "12500,5" / 12500 → number */
export function parseNumberID(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim()
  if (!s || s === '-') return null
  s = s.replace(/rp/gi, '').replace(/\s/g, '')
  const neg = /^-|^\(.*\)$/.test(s)
  s = s.replace(/[()-]/g, '')
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '') // 12,500 (format Inggris)
  else if (s.includes(',')) s = s.replace(',', '.') // 12500,5 (desimal koma)
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '') // 12.500 (format Indonesia)
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN
  const n = Number(s)
  return neg ? -n : n
}

const norm = (s: unknown) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const HEADER_KEYS: Record<string, keyof ParsedRow | 'brand' | 'section'> = {
  'sku id': 'sku_id',
  'product id': 'product_id',
  'nama produk': 'product_name',
  'nama sku/varian': 'variant',
  'nama sku / varian': 'variant',
  varian: 'variant',
  'harga jual': 'harga_jual',
  hpp: 'hpp',
  catatan: 'catatan',
  brand: 'brand',
  toko: 'brand',
  section: 'section',
}

type Cell = string | number | null

/** Ubah ID dari sel jadi teks; angka besar (presisi hilang di Excel) ditandai. */
function idText(v: Cell): { text: string; lossy: boolean } {
  if (v === null || v === undefined) return { text: '', lossy: false }
  if (typeof v === 'number') {
    if (Number.isSafeInteger(v)) return { text: String(v), lossy: false }
    return { text: v.toLocaleString('fullwide', { useGrouping: false }), lossy: true }
  }
  return { text: String(v).trim().replace(/^'/, ''), lossy: false }
}

function rowsFromGrid(grid: Cell[][], sheet: string): { rows: ParsedRow[]; hasBrand: boolean } | null {
  // cari baris header (Master HPP bisa punya baris judul di atas)
  let headerIdx = -1
  let map: Array<string | undefined> = []
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const m = grid[i].map((c) => HEADER_KEYS[norm(c)] as string | undefined)
    if (m.includes('sku_id') && m.includes('hpp')) {
      headerIdx = i
      map = m
      break
    }
  }
  if (headerIdx < 0) return null
  const hasBrand = map.includes('brand')
  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const line = grid[i]
    if (!line || line.every((c) => c === null || String(c).trim() === '')) continue
    const get = (k: string): Cell => {
      const j = map.indexOf(k)
      return j >= 0 ? (line[j] ?? null) : null
    }
    const sku = idText(get('sku_id'))
    const pid = idText(get('product_id'))
    const hppRaw = get('hpp')
    const hpp = parseNumberID(hppRaw)
    const harga = parseNumberID(get('harga_jual'))
    const txt = (v: Cell) => (v === null || String(v).trim() === '' ? null : String(v).trim())
    let problem: string | null = null
    if (!sku.text) problem = 'SKU ID kosong'
    else if (sku.lossy || pid.lossy) problem = 'ID tersimpan sebagai angka di Excel (digit terakhir hilang) — format kolom sebagai Teks'
    else if (hpp === null) problem = 'HPP kosong'
    else if (Number.isNaN(hpp)) problem = `HPP bukan angka: "${hppRaw}"`
    else if (hpp < 0) problem = 'HPP tidak boleh negatif'
    rows.push({
      sheet,
      rowNo: i + 1,
      brand: txt(get('brand')),
      section: txt(get('section')),
      sku_id: sku.text,
      product_id: pid.text || null,
      product_name: txt(get('product_name')),
      variant: txt(get('variant')),
      harga_jual: harga !== null && !Number.isNaN(harga) ? harga : null,
      hpp: hpp !== null && !Number.isNaN(hpp) ? hpp : null,
      catatan: txt(get('catatan')),
      problem,
    })
  }
  return { rows, hasBrand }
}

function cellValue(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: string; richText?: Array<{ text: string }> }
    if (o.richText) return o.richText.map((t) => t.text).join('')
    if (o.text !== undefined) return o.text
    if (o.result !== undefined) return cellValue(o.result)
  }
  return String(v)
}

/** Parser CSV sederhana (RFC 4180), deteksi pemisah , atau ; */
function parseCsv(text: string): Cell[][] {
  text = text.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const out: Cell[][] = []
  let row: Cell[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else q = false
      } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === delim) {
      row.push(cur)
      cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      out.push(row)
      row = []
      cur = ''
    } else cur += ch
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    out.push(row)
  }
  return out
}

export async function parseHppFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const grid = parseCsv(await file.text())
    const res = rowsFromGrid(grid, 'CSV')
    if (!res) throw new Error('Header tidak ditemukan. Pastikan ada kolom "SKU ID" dan "HPP".')
    return { kind: 'csv', sheets: ['CSV'], rows: res.rows, hasBrandColumn: res.hasBrand }
  }
  if (!name.endsWith('.xlsx')) throw new Error('Format file harus .xlsx atau .csv')

  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const rows: ParsedRow[] = []
  const sheets: string[] = []
  let hasBrand = false
  wb.eachSheet((ws) => {
    const grid: Cell[][] = []
    ws.eachRow({ includeEmpty: true }, (r, rowNumber) => {
      const vals = r.values as unknown[] // index 0 kosong (ExcelJS 1-based)
      grid[rowNumber - 1] = vals.slice(1).map(cellValue)
    })
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = []
    const res = rowsFromGrid(grid, ws.name)
    if (res) {
      sheets.push(ws.name)
      rows.push(...res.rows)
      hasBrand = hasBrand || res.hasBrand
    }
  })
  if (sheets.length === 0) throw new Error('Tidak ada sheet dengan kolom "SKU ID" dan "HPP".')
  return { kind: 'xlsx', sheets, rows, hasBrandColumn: hasBrand }
}
