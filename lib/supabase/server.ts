import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase client untuk Route Handler / Server Component.
 * HANYA anon key + cookie sesi user → semua akses tetap lewat RLS & cek RPC di database.
 * Service role key tidak dipakai di web.
 */
export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Konfigurasi Supabase belum diisi (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).')
  const cookieStore = await cookies()
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // dipanggil dari konteks yang tidak bisa menulis cookie — aman diabaikan (proxy.ts menyegarkan sesi)
        }
      },
    },
  })
}
