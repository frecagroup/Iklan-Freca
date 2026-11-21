'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info, Package, Percent } from 'lucide-react'
import { PillTabs } from '@/components/form'
import { HppTab } from '@/components/settings/hpp-tab'
import { TaxTab } from '@/components/settings/tax-tab'
import { useToast } from '@/components/toast'
import { useDashboard } from '@/lib/data'

/**
 * Pengaturan hanya untuk editor (ads.is_settings_editor() = true, yaitu email di ads.settings_editors).
 * User view-only (atau bila cek gagal) langsung diarahkan ke Ringkasan.
 * Database tetap menolak semua tulis dari non-editor — ini lapisan tampilan.
 */
export default function PengaturanPage() {
  const { isEditor, editorError } = useDashboard()
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<'hpp' | 'pajak'>('hpp')
  const redirected = useRef(false)

  useEffect(() => {
    if (isEditor !== false || redirected.current) return
    redirected.current = true
    toast.show('Halaman Pengaturan hanya untuk admin', 'bad')
    if (editorError) toast.show(editorError, 'bad')
    router.replace('/')
  }, [isEditor, editorError, router, toast])

  if (isEditor !== true) {
    // belum diketahui / sedang dialihkan: jangan tampilkan isi HPP & Pajak
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-12 w-60 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-12 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    )
  }

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

      {tab === 'hpp' ? <HppTab /> : <TaxTab />}
    </div>
  )
}
