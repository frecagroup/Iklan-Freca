'use client'

import { useState } from 'react'
import { Info, Lock, Package, Percent } from 'lucide-react'
import { PillTabs } from '@/components/form'
import { HppTab } from '@/components/settings/hpp-tab'
import { TaxTab } from '@/components/settings/tax-tab'
import { useQuery } from '@/lib/data'
import { fetchIsEditor } from '@/lib/settings'

export default function PengaturanPage() {
  const [tab, setTab] = useState<'hpp' | 'pajak'>('hpp')
  const editor = useQuery('settings-editor', fetchIsEditor)
  const canEdit = editor.data === true

  return (
    <div className="space-y-4">
      <PillTabs
        value={tab}
        onChange={setTab}
        items={[
          ['hpp', <><Package className="h-4 w-4" /> HPP</>],
          ['pajak', <><Percent className="h-4 w-4" /> Pajak Spend</>],
        ]}
      />

      <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <span>
          Perubahan <b className="font-semibold text-foreground">berlaku mulai tanggal yang dipilih</b> dan tidak mengubah profit hari-hari
          sebelumnya. Profit hari ini dihitung ulang otomatis pada sinkron VPS berikutnya (≤15 menit).
        </span>
      </p>

      {editor.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{editor.error}</p>
      )}
      {(editor.data === false || (editor.error && !canEdit)) && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm font-medium text-foreground">
          <Lock className="h-4 w-4 flex-shrink-0 text-warning" />
          Hanya admin yang bisa mengubah HPP &amp; pajak. Export tetap bisa.
        </p>
      )}

      {tab === 'hpp' ? <HppTab canEdit={canEdit} /> : <TaxTab canEdit={canEdit} />}
    </div>
  )
}
