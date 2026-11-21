# Freca Ads Dashboard

Dashboard performa iklan Freca Group — **Next.js (App Router) + TypeScript + Tailwind v4 + Supabase**.
Tampilan disamakan dengan web Absensi Freca (warna, font Inter, sidebar navy, kartu, tab bawah di HP).
Bisa dipasang sebagai aplikasi (PWA, "Add to Home Screen") dengan nama **Freca Ads** dan ikon F merah.

Data di Supabase diisi otomatis oleh VPS setiap 15 menit. Web ini **hanya membaca**.

## Fitur

| Halaman | Isi |
|---|---|
| **Ringkasan** (`/`) | Pilih periode (Hari ini berjalan, Kemarin, 7 hari, 30 hari, atau kalender rentang). Kartu Grand Total: GMV, Spend, ROAS, Profit, POAS, NPM, Order, CPR. Daftar produk "Perlu dicek". Satu kartu per brand. |
| **Detail Brand** (`/brand/ghazal`, `/brand/sultan-kasturi`, `/brand/freca`, `/brand/momea`) | Tabel per produk: Produk, GMV, Pesanan, Spend Iklan, CPR, ROAS, Profit, POAS, NPM + baris **Summary** tebal. Klik judul kolom untuk mengurutkan. |
| **Tren** (`/tren`) | Grafik garis harian 30 hari (GMV, Spend, Profit) dan grafik NPM, per brand atau semua, plus tabel harian. |
| **Komparasi** (`/komparasi`, tab HP "Banding") | **Toko vs Toko** (satu periode, dua toko) atau **Periode vs Periode** (satu toko, dua periode), level **Per produk** / **Per toko**. Kartu ringkasan A vs B + perubahan (hijau membaik, merah memburuk; Spend & CPR naik = memburuk), tabel A \| B \| Δ \| % per metrik (desktop) / kartu accordion (HP), baris Summary. Toko vs Toko per produk juga menampilkan tabel produk tiap toko berdampingan. Pilihan tersimpan di URL (`?mode=periode&brand=Ghazal&a=2026-11-12_2026-11-13&b=2026-11-15_2026-11-16&level=product`) sehingga bisa dibagikan. Data dari RPC `ads.compare` & `ads.period_summary`. |
| **Pengaturan** (`/pengaturan`, tab HP "Setting") | Tab **HPP**: HPP berlaku hari ini per SKU (filter brand, cari, sembunyikan nonaktif), Ubah / Tambah SKU dengan tanggal berlaku (tidak boleh mundur), riwayat versi per SKU (hapus versi terjadwal), **Export** `.xlsx` (satu sheet per section, format Master HPP Freca) / `.csv`, **Import** `.xlsx`/`.csv` dengan pratinjau HPP lama vs baru. Tab **Pajak Spend**: persen TikTok & Shopee PPN + riwayat. **Hanya untuk editor** (`ads.is_settings_editor()`): menu tidak tampil untuk user lain dan membuka `/pengaturan` langsung diarahkan ke Ringkasan. |

- Badge merah untuk produk dengan **NPM < 10%** atau **profit negatif**.
- "Update terakhir: HH:MM WIB" dari tabel `sync_status`; titik hijau berubah merah bila status bukan `ok` atau data lebih dari 45 menit tidak diperbarui.
- Auto-refresh tiap 5 menit + tombol Refresh (juga refresh saat aplikasi dibuka lagi dari background).
- Format Rupiah Indonesia (`Rp1.234.567`, desimal pakai koma), semua tanggal di zona **Asia/Jakarta**.
- Pemilih tanggal: satu kalender rentang dalam satu popup — klik tanggal awal lalu tanggal akhir (klik tanggal yang sama dua kali = 1 hari), preset cepat Hari ini / Kemarin / 7 hari / 30 hari / Bulan ini, tanggal setelah hari ini (WIB) tidak bisa dipilih. Desktop 2 bulan, HP 1 bulan (bottom sheet).
- Mode gelap (tombol 🌙), sama seperti Absensi.

### Versi HPP & pajak

Setiap perubahan HPP/pajak disimpan sebagai **versi baru** dengan `berlaku_mulai` (hari ini atau tanggal ke depan). Profit hari-hari sebelumnya tidak berubah; profit hari ini dihitung ulang oleh VPS pada sinkron berikutnya (≤15 menit). Semua tulisan lewat RPC di schema `ads` — web tidak menulis tabel langsung.

**Syarat:** schema `ads` harus ditambahkan di Supabase → Project Settings → Data API → **Exposed schemas**. Kalau belum, halaman Komparasi/Pengaturan menampilkan "Schema ads belum di-expose di Supabase (Settings → Data API)". Pembacaan HPP/pajak memakai view read-only di schema `public` (`ads_hpp_current`, `ads_hpp_versions`, `ads_tax_current`, `ads_tax_versions`).

### Cara angka dihitung

Untuk periode lebih dari 1 hari dan baris Summary, rasio **dihitung ulang dari total**, bukan rata-rata kolom rasio:

- ROAS = GMV ÷ Spend
- POAS = Profit ÷ Spend
- NPM = Profit ÷ GMV × 100
- CPR = Spend ÷ Order

Spend sudah termasuk pajak 2%. **Profit = estimasi** (fee settlement riil, cancel/RTS 30 hari, HPP master).

## Keamanan

- Semua halaman wajib login (Supabase Auth email + password). Cek sesi dilakukan di server (`proxy.ts`) sebelum halaman dirender.
- Hanya user yang sudah terdaftar yang bisa masuk — **tidak ada halaman daftar**. Matikan juga pendaftaran publik di Supabase (lihat langkah 2).
- Frontend hanya memakai **anon key**. **Service role key jangan pernah** dimasukkan ke env Vercel / kode web — hanya dipakai di VPS.
- RLS aktif: `SELECT` hanya untuk role `authenticated`; tidak ada policy insert/update/delete untuk web.
- **Menu Pengaturan hanya untuk email di `ads.settings_editors`; user lain hanya bisa melihat.** Status editor diambil dari RPC `ads.is_settings_editor()` sekali per sesi (diulang saat refresh atau user berganti). User view-only tidak melihat menu Pengaturan, dan membuka `/pengaturan` langsung diarahkan ke Ringkasan; bila cek gagal, user diperlakukan sebagai bukan editor. Ringkasan, Detail Brand, Tren, dan Komparasi tetap bisa dibuka semua user yang login. Penolakan sebenarnya tetap di database: semua RPC tulis (`ads.set_hpp`, `ads.import_hpp`, `ads.set_tax`, `ads.delete_future_version`) menolak non-editor.

## Deploy

### 1. Siapkan database

Supabase → **SQL Editor** → New query → paste isi [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
Membuat tabel `ads_daily` + `sync_status`, index, dan RLS. Aman dijalankan ulang.

> Kalau tabel sudah dibuat oleh VPS, file ini tetap aman: `create table if not exists` tidak mengubah tabel yang ada, lalu RLS & policy diterapkan.
> Pastikan `ads_daily` punya unique key `(date, brand, product)` supaya upsert dari VPS tidak menggandakan baris.

### 2. Atur Auth

Supabase → **Authentication**:

1. **Sign In / Providers → Email**: aktif. Matikan **Allow new users to sign up** (supaya tidak ada yang bisa daftar sendiri).
2. **Users → Add user → Create new user**: isi email + password untuk tiap orang yang boleh melihat dashboard (centang *Auto Confirm User*).
3. **URL Configuration → Site URL**: isi URL Vercel (mis. `https://iklan-freca.vercel.app`).

### 3. Deploy ke Vercel

1. Vercel → **Add New… → Project** → Import repo GitHub `frecagroup/iklan-freca`.
2. Framework: **Next.js** (terdeteksi otomatis). Build command & output biarkan default.
3. **Environment Variables** (Production + Preview):

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |

4. **Deploy**. Setelah env diubah, lakukan **Redeploy** (env `NEXT_PUBLIC_*` dibaca saat build).

Setiap push ke `main` akan otomatis deploy ulang.

### 4. Pasang di HP

- **Android (Chrome)**: buka URL → menu ⋮ → **Tambahkan ke layar utama / Install app**.
- **iPhone (Safari)**: buka URL → tombol Share → **Add to Home Screen**.

## Jalankan lokal

```bash
cp .env.example .env.local   # isi URL & anon key
npm install
npm run dev                  # http://localhost:3000
npm run lint && npm run build # cek sebelum push
```

Butuh Node.js ≥ 20.9.

## Struktur

```
app/
  (dash)/layout.tsx        # shell: sidebar (desktop) + header & tab bawah (HP)
  (dash)/page.tsx          # Ringkasan
  (dash)/brand/[slug]/     # Detail per brand
  (dash)/tren/             # Grafik tren
  (dash)/komparasi/        # Komparasi toko vs toko / periode vs periode
  (dash)/pengaturan/       # Setting HPP & Pajak Spend
  login/                   # Halaman login
  globals.css              # token warna & tema dari web Absensi
components/                # UI (ui.tsx & toast.tsx disalin dari Absensi), tabel, grafik, filter periode
  date-range-picker.tsx    # kalender rentang satu popup (dipakai Ringkasan, Detail Brand, Tren, Komparasi)
  form.tsx                 # input Rupiah/persen/tanggal, drawer, tab pill
  compare/                 # kartu ringkasan & tabel komparasi
  settings/                # tab HPP (edit, riwayat, import) & tab Pajak
lib/
  data.tsx                 # periode, auto-refresh, useQuery, query Supabase (paginasi 1000 baris)
  settings.ts              # view HPP/pajak + RPC ads.set_hpp / import_hpp / set_tax / delete_future_version
  hpp-file.ts              # export/import Master HPP (.xlsx via exceljs, .csv)
  compare.ts               # RPC ads.compare & ads.period_summary + format Δ/%
  metrics.ts               # agregasi & aturan peringatan
  format.ts                # format Rupiah / tanggal WIB
  supabase/client.ts       # browser client (anon key)
proxy.ts                   # wajib login di semua halaman (Next.js 16 "proxy", pengganti middleware)
public/
  manifest.json, sw.js     # PWA
  icon-*.png, apple-touch-icon.png   # ikon F Freca latar merah
supabase/schema.sql        # tabel + RLS
scripts/make_icons.py      # generate ulang ikon (Pillow)
```

## Catatan

- Brand yang dikenali: Ghazal, Sultan Kasturi, Freca, Momea (`lib/metrics.ts` → `BRANDS`). Brand baru dari VPS tetap muncul di Ringkasan; tambahkan ke `BRANDS` agar punya tab & halaman detail.
- Batas NPM peringatan: `NPM_THRESHOLD = 10` di `lib/metrics.ts`.
- Kolom `npm` diasumsikan dalam persen (12,5 = 12,5%). Dashboard sendiri menghitung NPM dari profit ÷ GMV.
