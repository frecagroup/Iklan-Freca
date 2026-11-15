'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table2 } from 'lucide-react'
import { Card } from './ui'
import { decimal, percent, rupiah, rupiahShort, tanggal } from '@/lib/format'
import { NPM_THRESHOLD } from '@/lib/metrics'
import { cn } from '@/lib/cn'

export type DayPoint = {
  date: string
  label: string
  gmv: number
  spend: number
  profit: number
  npm: number | null
  roas: number | null
  orders: number
  partial: boolean
}

const MONEY = [
  { key: 'gmv', label: 'GMV', color: 'var(--chart-gmv)' },
  { key: 'spend', label: 'Spend', color: 'var(--chart-spend)' },
  { key: 'profit', label: 'Profit', color: 'var(--chart-profit)' },
] as const

const axisTick = { fill: 'var(--chart-axis)', fontSize: 11 }

/** Titik hanya di hari ini (masih berjalan) — angkanya belum final */
function partialDot(color: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function PartialDot(props: any) {
    const { cx, cy, payload, index } = props as { cx?: number; cy?: number; payload?: DayPoint; index?: number }
    if (!payload?.partial || cx == null || cy == null) return <g key={`d-${index}`} />
    return <circle key={`d-${index}`} cx={cx} cy={cy} r={4} fill="var(--color-card)" stroke={color} strokeWidth={2} />
  }
}

function TipShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{title}</p>
      {children}
    </div>
  )
}

type TipProps = { active?: boolean; payload?: Array<{ payload: DayPoint }> }

function MoneyTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <TipShell title={`${tanggal(p.date)}${p.partial ? ' (berjalan)' : ''}`}>
      {MONEY.map((m) => (
        <div key={m.key} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
          <span className="text-muted-foreground">{m.label}</span>
          <span className={cn('ml-auto font-semibold tabular-nums text-foreground', m.key === 'profit' && p.profit < 0 && 'text-destructive')}>
            {rupiah(p[m.key])}
          </span>
        </div>
      ))}
      <div className="mt-1 border-t border-border pt-1 text-muted-foreground">
        ROAS {decimal(p.roas)} · {p.orders} order
      </div>
    </TipShell>
  )
}

function NpmTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const low = p.npm !== null && p.npm < NPM_THRESHOLD
  return (
    <TipShell title={`${tanggal(p.date)}${p.partial ? ' (berjalan)' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">NPM</span>
        <span className={cn('ml-auto font-semibold tabular-nums', low ? 'text-destructive' : 'text-foreground')}>{percent(p.npm)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Profit</span>
        <span className="ml-auto tabular-nums text-foreground">{rupiah(p.profit)}</span>
      </div>
    </TipShell>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {MONEY.map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-0.5 w-4 rounded-full" style={{ background: m.color, height: 3 }} />
          {m.label}
        </span>
      ))}
    </div>
  )
}

export function MoneyChart({ data }: { data: DayPoint[] }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">GMV, Spend & Profit harian</h3>
          <p className="text-xs text-muted-foreground">30 hari terakhir · profit = estimasi · titik bulat = hari ini (berjalan)</p>
        </div>
        <Legend />
      </div>
      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => rupiahShort(v)} />
            <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.4} />
            <Tooltip content={<MoneyTip />} cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }} />
            {MONEY.map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                dot={partialDot(m.color)}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-card)' }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function NpmChart({ data }: { data: DayPoint[] }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-foreground">NPM harian</h3>
        <p className="text-xs text-muted-foreground">Garis merah putus-putus = batas {NPM_THRESHOLD}% · titik bulat = hari ini (berjalan)</p>
      </div>
      <div className="h-56 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${decimal(v, 0)}%`} />
            <ReferenceLine
              y={NPM_THRESHOLD}
              stroke="var(--color-destructive)"
              strokeDasharray="5 4"
            />
            <Tooltip content={<NpmTip />} cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }} />
            <Line
              type="monotone"
              dataKey="npm"
              name="NPM"
              stroke="var(--chart-npm)"
              strokeWidth={2}
              connectNulls
              dot={partialDot('var(--chart-npm)')}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-card)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

/** Tabel harian (pendamping grafik — angka persis tanpa harus hover) */
export function DailyTable({ data }: { data: DayPoint[] }) {
  const [open, setOpen] = useState(false)
  const rows = [...data].reverse()
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <Table2 className="h-4 w-4" /> {open ? 'Sembunyikan tabel harian' : 'Lihat tabel harian'}
      </button>
      {open && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                  <th className="sticky-col bg-muted px-3 py-2 text-left font-semibold">Tanggal</th>
                  <th className="px-3 py-2 text-right font-semibold">GMV</th>
                  <th className="px-3 py-2 text-right font-semibold">Spend</th>
                  <th className="px-3 py-2 text-right font-semibold">Profit*</th>
                  <th className="px-3 py-2 text-right font-semibold">NPM</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.date} className="border-b border-border/70 last:border-0">
                    <td className="sticky-col whitespace-nowrap bg-card px-3 py-2 text-foreground">
                      {tanggal(p.date, false)}
                      {p.partial && <span className="ml-1 text-[11px] text-muted-foreground">(berjalan)</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rupiah(p.gmv)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rupiah(p.spend)}</td>
                    <td className={cn('whitespace-nowrap px-3 py-2 text-right tabular-nums', p.profit < 0 && 'text-destructive')}>{rupiah(p.profit)}</td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-3 py-2 text-right tabular-nums',
                        p.npm !== null && p.npm < NPM_THRESHOLD && 'text-destructive',
                      )}
                    >
                      {percent(p.npm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
