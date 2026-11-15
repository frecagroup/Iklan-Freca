import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Semua halaman wajib login. Proxy menyegarkan sesi Supabase (cookie) di setiap request,
// lalu mengarahkan user yang belum login ke /login.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const { pathname } = request.nextUrl
  const isLogin = pathname === '/login'

  if (!url || !anon) {
    // env belum diset: tetap kunci semua halaman kecuali /login (yang akan menampilkan pesan)
    if (isLogin) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // getUser() memverifikasi token ke server Supabase (bukan sekadar membaca cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isLogin) {
    const to = new URL('/login', request.url)
    if (pathname !== '/') to.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(to)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (user && isLogin) {
    const redirect = NextResponse.redirect(new URL('/', request.url))
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return response
}

export const config = {
  matcher: [
    // kecualikan aset statis, ikon, manifest & service worker
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:png|jpg|jpeg|svg|ico|webp|webmanifest)$).*)',
  ],
}
