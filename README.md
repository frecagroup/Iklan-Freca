# Freca Ads Dashboard

Dashboard performa iklan Freca Group — **Next.js (App Router) + TypeScript + Tailwind v4 + Supabase**.
Tampilan disamakan dengan web Absensi Freca (warna, font Inter, sidebar navy, kartu, tab bawah di HP).
Bisa dipasang sebagai aplikasi (PWA, "Add to Home Screen") dengan nama **Freca Ads** dan ikon F merah.

Data di Supabase diisi otomatis oleh VPS setiap 15 menit. Web ini **hanya membaca**.

## Fitur

| Halaman | Isi |
|---|---|
| **Ringkasan** (`/`) | Pilih periode (Hari ini berjalan, Kemarin, 7 hari, 30 hari, Custom). Kartu Grand Total: GMV, Spend, ROAS, Profit, POAS, NPM, Order, CPR. Daftar produk "Perlu dicek". Satu kartu per brand. |
| **Detail Brand** (`/brand/ghazal`, `/brand/sultan-kasturi`, `/brand/freca`, `/brand/momea`) | Tabel per produk: Produk, GMV, Spend Iklan, CPR, ROAS, Profit, POAS, NPM + baris **Summary** tebal. Klik judul kolom untuk mengurutkan. |
| **Tren** (`/tren`) | Grafik garis harian 30 hari (GMV, Spend, Profit) dan grafik NPM, per brand atau semua, plus tabel harian. |

- Badge merah untuk produk dengan **NPM < 10%** atau **profit negatif**.
- "Update terakhir: HH:MM WIB" dari tabel `sync_status`; titik hijau berubah merah bila status bukan `ok` atau data lebih dari 45 menit tidak diperbarui.
- Auto-refresh tiap 5 menit + tombol Refresh (juga refresh saat aplikasi dibuka lagi dari background).
- Format Rupiah Indonesia (`Rp1.234.567`, desimal pakai koma), semua tanggal di zona **Asia/Jakarta**.
- Mode gelap (tombol 🌙), sama seperti Absensi.

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
```

Butuh Node.js ≥ 20.9.

## Struktur

```
app/
  (dash)/layout.tsx        # shell: sidebar (desktop) + header & tab bawah (HP)
  (dash)/page.tsx          # Ringkasan
  (dash)/brand/[slug]/     # Detail per brand
  (dash)/tren/             # Grafik tren
  login/                   # Halaman login
  globals.css              # token warna & tema dari web Absensi
components/                # UI (ui.tsx disalin dari Absensi), tabel, grafik, filter periode
lib/
  data.tsx                 # periode, auto-refresh, query Supabase (paginasi 1000 baris)
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
