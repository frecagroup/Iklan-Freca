-- =====================================================================
-- Freca Ads Dashboard — tabel + RLS
-- Jalankan di Supabase: SQL Editor → New query → paste → Run.
-- Aman dijalankan ulang (idempotent).
--
-- Penulisan data dilakukan VPS memakai SERVICE ROLE KEY (bypass RLS).
-- Web hanya BACA memakai anon key + sesi login (role "authenticated").
-- =====================================================================

-- ---------- ads_daily: satu baris per tanggal x brand x produk ----------
create table if not exists public.ads_daily (
  date              date        not null,
  brand             text        not null,          -- Ghazal, Sultan Kasturi, Freca, Momea
  product           text        not null,
  orders            integer     not null default 0,
  gmv               numeric     not null default 0,
  spend             numeric     not null default 0, -- sudah termasuk pajak 2%
  cpr               numeric,
  roas              numeric,
  profit            numeric,                        -- estimasi
  poas              numeric,
  npm               numeric,                        -- persen, mis. 12.5 = 12,5%
  margin_per_order  numeric,
  fee_pct           numeric,
  cancel_pct        numeric,
  rts_pct           numeric,
  updated_at        timestamptz not null default now(),
  primary key (date, brand, product)
);

create index if not exists ads_daily_date_idx       on public.ads_daily (date);
create index if not exists ads_daily_brand_date_idx on public.ads_daily (brand, date);

-- ---------- sync_status: status sinkron terakhir dari VPS ----------
create table if not exists public.sync_status (
  id        smallint    primary key default 1,
  last_run  timestamptz not null default now(),
  status    text,                                   -- mis. 'ok' / 'error'
  note      text
);

-- ---------- RLS: SELECT hanya untuk user login ----------
alter table public.ads_daily   enable row level security;
alter table public.sync_status enable row level security;

drop policy if exists "ads_daily_select_authenticated" on public.ads_daily;
create policy "ads_daily_select_authenticated"
  on public.ads_daily for select
  to authenticated
  using (true);

drop policy if exists "sync_status_select_authenticated" on public.sync_status;
create policy "sync_status_select_authenticated"
  on public.sync_status for select
  to authenticated
  using (true);

-- Tidak ada policy INSERT/UPDATE/DELETE → web (anon/authenticated) tidak bisa menulis.
-- Lapisan kedua: cabut hak tulis di level GRANT.
revoke insert, update, delete, truncate on public.ads_daily   from anon, authenticated;
revoke insert, update, delete, truncate on public.sync_status from anon, authenticated;
revoke select on public.ads_daily   from anon;
revoke select on public.sync_status from anon;
grant  select on public.ads_daily   to authenticated;
grant  select on public.sync_status to authenticated;

-- =====================================================================
-- Contoh penulisan dari VPS (pakai service role key, BUKAN dari web):
--
--   insert into public.ads_daily (date, brand, product, orders, gmv, spend, cpr, roas,
--          profit, poas, npm, margin_per_order, fee_pct, cancel_pct, rts_pct, updated_at)
--   values (...)
--   on conflict (date, brand, product) do update set
--     orders = excluded.orders, gmv = excluded.gmv, spend = excluded.spend,
--     cpr = excluded.cpr, roas = excluded.roas, profit = excluded.profit,
--     poas = excluded.poas, npm = excluded.npm, margin_per_order = excluded.margin_per_order,
--     fee_pct = excluded.fee_pct, cancel_pct = excluded.cancel_pct, rts_pct = excluded.rts_pct,
--     updated_at = now();
--
--   insert into public.sync_status (id, last_run, status, note)
--   values (1, now(), 'ok', '42 baris')
--   on conflict (id) do update set last_run = excluded.last_run,
--     status = excluded.status, note = excluded.note;
--
-- Via REST (supabase-js / PostgREST): upsert dengan onConflict 'date,brand,product'.
-- =====================================================================
