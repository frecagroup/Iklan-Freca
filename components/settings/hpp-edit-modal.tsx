'use client'

import { useState } from 'react'
import { Button, Field, Input, Modal, selectClass } from '../ui'
import { DateInput, RupiahInput, TextArea } from '../form'
import { useToast } from '../toast'
import { errorMessage, useDashboard } from '@/lib/data'
import { rupiah, tanggal } from '@/lib/format'
import { BRANDS } from '@/lib/metrics'
import { BRAND_SECTION, setHpp, type HppRow } from '@/lib/settings'

/** Modal Ubah HPP (row ada) atau Tambah SKU (row = null). Render hanya saat terbuka. */
export function HppEditModal({ row, onClose, onSaved }: { row: HppRow | null; onClose: () => void; onSaved: () => void }) {
  const { today } = useDashboard()
  const toast = useToast()
  const isAdd = row === null
  const [hpp, setHppVal] = useState<number | null>(row?.hpp ?? null)
  const [berlaku, setBerlaku] = useState(today)
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  // khusus Tambah SKU
  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [section, setSection] = useState('')
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [variant, setVariant] = useState('')
  const [harga, setHarga] = useState<number | null>(null)

  const save = async () => {
    if (isAdd && !sku.trim()) return toast.show('SKU ID wajib diisi', 'bad')
    if (isAdd && !brand) return toast.show('Brand wajib dipilih', 'bad')
    if (hpp === null) return toast.show('HPP baru wajib diisi', 'bad')
    if (berlaku < today) return toast.show('Tanggal berlaku tidak boleh sebelum hari ini', 'bad')
    setSaving(true)
    try {
      await setHpp({
        p_sku_id: isAdd ? sku.trim() : row.sku_id,
        p_hpp: hpp,
        p_berlaku_mulai: berlaku,
        p_catatan: catatan.trim() || null,
        ...(isAdd
          ? {
              p_brand: brand,
              p_section: section.trim() || BRAND_SECTION[brand as keyof typeof BRAND_SECTION] || null,
              p_product_id: productId.trim() || null,
              p_product_name: productName.trim() || null,
              p_variant: variant.trim() || null,
              p_harga_jual: harga,
            }
          : {}),
      })
      toast.show(
        berlaku === today ? 'HPP disimpan, berlaku mulai hari ini' : `HPP dijadwalkan mulai ${tanggal(berlaku)}`,
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
      title={isAdd ? 'Tambah SKU' : 'Ubah HPP'}
      size={isAdd ? 'lg' : 'md'}
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
        {!isAdd && (
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <p className="font-semibold text-foreground">{row.product_name}</p>
            {row.variant && <p className="text-muted-foreground">{row.variant}</p>}
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">SKU {row.sku_id}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              HPP sekarang <b className="text-foreground">{rupiah(row.hpp)}</b>
              {row.berlaku_mulai && <> · sejak {tanggal(row.berlaku_mulai)}</>}
            </p>
          </div>
        )}

        {isAdd && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="SKU ID *" value={sku} onChange={(e) => setSku(e.target.value)} inputMode="numeric" placeholder="ID SKU TikTok" />
            <Field label="Brand *">
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selectClass()}>
                <option value="">Pilih brand…</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Input
              label="Section (tab Master HPP)"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder={brand ? BRAND_SECTION[brand as keyof typeof BRAND_SECTION] : 'mis. Sulkas Gaharu'}
            />
            <Input label="Product ID" value={productId} onChange={(e) => setProductId(e.target.value)} inputMode="numeric" />
            <Input label="Nama Produk" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <Input label="Nama SKU/Varian" value={variant} onChange={(e) => setVariant(e.target.value)} />
            <Field label="Harga Jual">
              <RupiahInput value={harga} onChange={setHarga} />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isAdd ? 'HPP *' : 'HPP baru *'}>
            <RupiahInput value={hpp} onChange={setHppVal} autoFocus={!isAdd} />
          </Field>
          <Field label="Berlaku mulai">
            <DateInput value={berlaku} onChange={setBerlaku} min={today} />
          </Field>
        </div>
        <Field label="Catatan (opsional)">
          <TextArea value={catatan} onChange={setCatatan} placeholder="mis. harga supplier naik" />
        </Field>
        <p className="text-xs text-muted-foreground">
          Profit sebelum tanggal berlaku tidak berubah. Profit hari ini dihitung ulang otomatis pada sinkron berikutnya (≤15 menit).
        </p>
      </div>
    </Modal>
  )
}
