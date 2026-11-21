'use client'

import { useState } from 'react'
import { CalendarClock, Trash2 } from 'lucide-react'
import { Badge, Button, Spinner } from '../ui'
import { Drawer } from '../form'
import { useToast } from '../toast'
import { ErrorBox } from '../metrics-view'
import { errorMessage, useDashboard, useQuery } from '@/lib/data'
import { jamWIB, rupiah, tanggal, todayWIB } from '@/lib/format'
import { deleteFutureVersion, fetchHppVersions, type HppRow } from '@/lib/settings'
import { cn } from '@/lib/cn'

/** Drawer riwayat versi HPP satu SKU. Render hanya saat terbuka. */
export function HppHistoryDrawer({
  row,
  canEdit,
  onClose,
  onChanged,
}: {
  row: HppRow
  canEdit: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { today } = useDashboard()
  const toast = useToast()
  const [ver, setVer] = useState(0)
  const [deleting, setDeleting] = useState<number | null>(null)
  const { data, error } = useQuery(`hpp-versions|${row.sku_id}|${ver}`, () => fetchHppVersions(row.sku_id), {
    keepPrevious: true,
  })

  // versi yang berlaku hari ini = berlaku_mulai terbesar yang ≤ hari ini
  const currentId = data?.find((v) => v.berlaku_mulai <= today)?.id

  const del = async (id: number) => {
    setDeleting(id)
    try {
      const ok = await deleteFutureVersion('hpp', id)
      toast.show(ok ? 'Perubahan terjadwal dihapus' : 'Versi tidak dihapus (mungkin sudah berlaku)', ok ? 'ok' : 'bad')
      setVer((v) => v + 1)
      onChanged()
    } catch (e) {
      toast.show(errorMessage(e), 'bad')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Riwayat HPP"
      subtitle={
        <>
          <span className="font-medium text-foreground">{row.product_name}</span>
          {row.variant && <> · {row.variant}</>}
          <span className="mt-0.5 block font-mono text-[11px]">SKU {row.sku_id}</span>
        </>
      }
    >
      {error && <ErrorBox message={error} />}
      {!data && !error && (
        <div className="grid place-items-center py-10 text-muted-foreground">
          <Spinner />
        </div>
      )}
      {data && data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada riwayat.</p>}
      {data && data.length > 0 && (
        <ol className="relative space-y-3 border-l-2 border-border pl-4">
          {data.map((v) => {
            const future = v.berlaku_mulai > today
            const current = v.id === currentId
            return (
              <li key={v.id} className="relative">
                <span
                  className={cn(
                    'absolute -left-[23px] top-3 h-3 w-3 rounded-full border-2 border-card',
                    current ? 'bg-primary' : future ? 'bg-warning' : 'bg-muted-foreground/40',
                  )}
                />
                <div className={cn('rounded-xl border p-3', current ? 'border-primary/40 bg-primary/5' : 'border-border bg-card')}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold tabular-nums text-foreground">{rupiah(v.hpp)}</p>
                      <p className="text-xs text-muted-foreground">Berlaku mulai {tanggal(v.berlaku_mulai)}</p>
                    </div>
                    {current && <Badge tone="primary">Berlaku</Badge>}
                    {future && (
                      <Badge tone="warning">
                        <CalendarClock /> Terjadwal
                      </Badge>
                    )}
                  </div>
                  {v.catatan && <p className="mt-2 text-sm text-foreground">{v.catatan}</p>}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {[
                      v.source && `via ${v.source}`,
                      v.created_by,
                      v.created_at && `${tanggal(todayWIB(new Date(v.created_at)))} ${jamWIB(v.created_at)} WIB`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {future && canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 text-destructive hover:bg-destructive hover:text-white"
                      loading={deleting === v.id}
                      onClick={() => del(v.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Hapus jadwal
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Drawer>
  )
}
