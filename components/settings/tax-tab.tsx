'use client'

import { useState } from 'react'
import { CalendarClock, Pencil, Percent, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Field, Modal } from '../ui'
import { DateInput, PercentInput, TextArea, parsePercent } from '../form'
import { ErrorBox } from '../metrics-view'
import { useToast } from '../toast'
import { errorMessage, useDashboard, useQuery } from '@/lib/data'
import { decimal, jamWIB, tanggal, todayWIB } from '@/lib/format'
import { deleteFutureVersion, fetchTax, PLATFORM_LABEL, setTax, type Platform, type TaxCurrent } from '@/lib/settings'
import { cn } from '@/lib/cn'

const PLATFORMS: Platform[] = ['tiktok', 'shopee']

const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${decimal(v, v % 1 === 0 ? 0 : 2)}%`)

function TaxModal({ platform, current, onClose, onSaved }: { platform: Platform; current: TaxCurrent | undefined; onClose: () => void; onSaved: () => void }) {
  const { today } = useDashboard()
  const toast = useToast()
  const [pct, setPct] = useState(current?.pct != null ? String(current.pct).replace('.', ',') : '')
  const [berlaku, setBerlaku] = useState(today)
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const n = parsePercent(pct)
    if (n === null || n < 0 || n > 100) return toast.show('Persen harus angka 0–100', 'bad')
    if (berlaku < today) return toast.show('Tanggal berlaku tidak boleh sebelum hari ini', 'bad')
    setSaving(true)
    try {
      await setTax(platform, n, berlaku, catatan.trim() || null)
      toast.show(
        berlaku === today ? `Pajak ${PLATFORM_LABEL[platform]} disimpan` : `Pajak ${PLATFORM_LABEL[platform]} dijadwalkan mulai ${tanggal(berlaku)}`,
        'ok',
      )
      onSaved()
      onClose()
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ubah pajak ${PLATFORM_LABEL[platform]}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} loading={saving}>
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sekarang <b className="text-foreground">{pctText(current?.pct)}</b>
          {current?.berlaku_mulai && <> · sejak {tanggal(current.berlaku_mulai)}</>}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Persen pajak *">
            <PercentInput value={pct} onChange={setPct} autoFocus />
          </Field>
          <Field label="Berlaku mulai">
            <DateInput value={berlaku} onChange={setBerlaku} min={today} />
          </Field>
        </div>
        <Field label="Catatan (opsional)">
          <TextArea value={catatan} onChange={setCatatan} />
        </Field>
      </div>
    </Modal>
  )
}

export function TaxTab({ canEdit }: { canEdit: boolean }) {
  const { today } = useDashboard()
  const toast = useToast()
  const [ver, setVer] = useState(0)
  const reload = () => setVer((v) => v + 1)
  const { data, error } = useQuery(`tax|${ver}`, fetchTax, { keepPrevious: true })
  const [editing, setEditing] = useState<Platform | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const del = async (id: number) => {
    setDeleting(id)
    try {
      const ok = await deleteFutureVersion('tax', id)
      toast.show(ok ? 'Perubahan terjadwal dihapus' : 'Versi tidak dihapus (mungkin sudah berlaku)', ok ? 'ok' : 'bad')
      reload()
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
        {PLATFORMS.map((p) => {
          const cur = data?.current.find((c) => c.platform === p)
          const next = data?.versions
            .filter((v) => v.platform === p && v.berlaku_mulai > today)
            .sort((a, b) => a.berlaku_mulai.localeCompare(b.berlaku_mulai))[0]
          return (
            <div
              key={p}
              className="min-w-0 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-amber-500/5 p-4 md:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="inline-flex rounded-lg bg-amber-500/15 p-2 text-amber-600">
                  <Percent className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{PLATFORM_LABEL[p]}</p>
                  <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{data ? pctText(cur?.pct) : '…'}</p>
                  <p className="text-xs text-muted-foreground">{cur?.berlaku_mulai ? `Berlaku sejak ${tanggal(cur.berlaku_mulai)}` : ' '}</p>
                  {next && (
                    <div className="mt-1.5">
                      <Badge tone="warning">
                        <CalendarClock /> {pctText(next.pct)} mulai {tanggal(next.berlaku_mulai, false)}
                      </Badge>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)} disabled={!data}>
                    <Pencil className="h-3.5 w-3.5" /> Ubah
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">Spend di dashboard sudah termasuk pajak sesuai persen yang berlaku pada tanggalnya.</p>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">Riwayat perubahan</h3>
        </div>
        {!data && !error && <div className="h-40 animate-pulse bg-muted/40" />}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                  <th className="sticky-col bg-muted px-3 py-2.5 text-left font-semibold">Platform</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Persen</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Berlaku Mulai</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Catatan</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Diubah</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.versions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Belum ada riwayat.
                    </td>
                  </tr>
                )}
                {data.versions.map((v) => {
                  const future = v.berlaku_mulai > today
                  return (
                    <tr key={v.id} className={cn('border-b border-border/70 last:border-0', future && 'bg-warning/5')}>
                      <td className="sticky-col whitespace-nowrap bg-card px-3 py-2.5 font-medium text-foreground">{PLATFORM_LABEL[v.platform] ?? v.platform}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{pctText(v.pct)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {tanggal(v.berlaku_mulai)}
                        {future && (
                          <span className="ml-1.5">
                            <Badge tone="warning">Terjadwal</Badge>
                          </span>
                        )}
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5 text-muted-foreground">{v.catatan ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                        {[v.created_by, v.created_at && `${tanggal(todayWIB(new Date(v.created_at)), false)} ${jamWIB(v.created_at)}`]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {future && canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive hover:text-white"
                            loading={deleting === v.id}
                            onClick={() => del(v.id)}
                            aria-label="Hapus jadwal"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <TaxModal platform={editing} current={data?.current.find((c) => c.platform === editing)} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </div>
  )
}
